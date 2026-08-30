import {
    ActionRowComponent,
    ActionRowPossible,
    ButtonComponent,
    ButtonStyle,
    Component,
    ComponentType,
    ContainerComponent, FileComponent,
    getFileType,
    MediaGalleryComponent,
    SectionComponent,
    setFileType
} from "components-sdk";
import { getFileNameType } from 'components-sdk/src/polyfills/files';

function isLinkButton(button: ButtonComponent): boolean {
    return button.style === ButtonStyle.URL && !!button.url;
}

function sanitizeComponent(comp: Component): Component | null {
    switch (comp.type) {
        case ComponentType.ACTION_ROW: {
            const row = comp as ActionRowComponent<ActionRowPossible>;
            const components = (row.components || []).filter((c) => {
                if (c.type === ComponentType.STRING_SELECT) return false;
                if (c.type === ComponentType.BUTTON) return isLinkButton(c as ButtonComponent);
                return false;
            });
            if (!components.length) return null;
            return { ...row, components };
        }
        case ComponentType.CONTAINER: {
            const container = comp as ContainerComponent;
            const components = sanitizeForWebhook(container.components);
            if (!components.length) return null;
            return { ...container, components };
        }
        case ComponentType.SECTION: {
            const section = comp as SectionComponent;
            if (
                section.accessory.type === ComponentType.BUTTON &&
                !isLinkButton(section.accessory as ButtonComponent)
            ) {
                return null;
            }
            return section;
        }
        default:
            return comp;
    }
}

function sanitizeForWebhook(components: Component[]): Component[] {
    return components
        .map(sanitizeComponent)
        .filter((c): c is Component => c !== null);
}

export const webhookImplementation = {
    getFile: ((name) => {
        return window.uploadedFiles[name];
    }) as getFileType,

    setFile: (async (name, file) => {
        window.uploadedFiles[name] = file
        return `attachment://${name}`
    }) as setFileType,

    getFileName: ((url: string) => {
        if (typeof (url as any) !== 'string') return null;
        const name = url.startsWith("attachment://") ? url.slice(13) : '';
        return name || null;
    }) as getFileNameType,

    scrapFiles(data: Component | Component[]): string[] {
        if (Array.isArray(data)) return data.flatMap(obj => this.scrapFiles(obj));

        if (data.type === ComponentType.SECTION) {
            const dataAsSection = data as SectionComponent;
            if (dataAsSection.accessory.type !== ComponentType.THUMBNAIL) return []

            const url = dataAsSection.accessory.media.url;
            if (url.startsWith("attachment://")) return [url.slice(13)]
        } else if (data.type === ComponentType.FILE) {
            const dataAsFile = data as FileComponent;

            const url = dataAsFile.file.url;
            if (url.startsWith("attachment://")) return [url.slice(13)]
        } else if (data.type === ComponentType.MEDIA_GALLERY) {
            const dataAsGallery = data as MediaGalleryComponent;

            return dataAsGallery.items
                .filter(item => item.media.url.startsWith("attachment://"))
                .map(item => item.media.url.slice(13))
        } else if (data.type === ComponentType.CONTAINER) {
            const dataAsContainer = data as ContainerComponent;
            return this.scrapFiles(dataAsContainer.components)
        }
        return []
    },

    init() {
        if (!window.uploadedFiles) window.uploadedFiles = {}
    },


    clean(state: Component[]) {
        const files = this.scrapFiles(state);
        for (const file of Object.keys(window.uploadedFiles)) {
            if (!files.includes(file)) delete window.uploadedFiles[file];
        }
    },

    prepareRequest(state: Component[], thread_name?: string): RequestInit {
        const sanitized = sanitizeForWebhook(state);
        const files = this.scrapFiles(sanitized);

        const data = JSON.stringify({
            components: sanitized,
            flags: 32768,
            thread_name,
        });

        if (!files.length) return {method: "POST", body: data, headers: {"Content-Type": "application/json"}}

        const form = new FormData();
        form.append('payload_json', data);
        files.map((filename, idx) => {
            let blob = window.uploadedFiles[filename];
            if (!blob) blob = new File([], filename, {type: "application/octet-stream"});
            form.append(`files[${idx}]`, blob, filename);
        })
        return {method: "POST", body: form, headers: {}}
    },

    getErrors(response: unknown) {
        if (response === null || typeof response !== 'object') return null;
        if (!("errors" in response)) return null;
        const responseErrors = response.errors;
        if (responseErrors === null || typeof responseErrors !== 'object') return null;
        if (!("components" in responseErrors)) return null;
        const components = responseErrors.components;
        if (components === null || typeof components !== 'object') return null;
        if (Array.isArray(components)) return null;

        return components as Record<string, any>;
    }

}