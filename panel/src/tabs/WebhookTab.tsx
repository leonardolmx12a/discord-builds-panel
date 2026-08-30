import { Capsule, Component, PassProps } from 'components-sdk';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { actions, DisplaySliceManager, RootState } from '@website/state';
import { BetterInput } from '@website/BetterInput';
import { EmojiPicker } from '@website/EmojiPicker';
import { EmojiShow } from '@website/EmojiShow';
import { ColorPicker } from '@website/ColorPicker';
import { webhookImplementation } from '@website/webhook.impl';
import { migrateMediaUrls } from '@website/mediaSerialization';
import { ErrorBoundary } from 'react-error-boundary';
import styles from './WebhookTab.module.css';

webhookImplementation.init();

function getThreadId(webhookUrl: string) {
    try {
        const parsed_url = new URL(webhookUrl);
        const parsed_query = new URLSearchParams(parsed_url.search);
        return parsed_query.get('thread_id') || null;
    } catch {
        return null;
    }
}

function parseImportJson(raw: string): Component[] {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
        return migrateMediaUrls(parsed) as Component[];
    }

    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.components)) {
        return migrateMediaUrls(parsed.components) as Component[];
    }

    throw new Error('JSON inválido. Use um array de components ou um objeto com "components".');
}

export default function WebhookTab() {
    const dispatch = useDispatch();
    const stateManager = useMemo(() => new DisplaySliceManager(dispatch), [dispatch]);
    const state = useSelector((s: RootState) => s.display.data);
    const webhookUrl = useSelector((s: RootState) => s.display.webhookUrl);
    const response = useSelector((s: RootState) => s.display.webhookResponse);
    const showThread = useSelector((s: RootState) => s.display.showThread);
    const [postTitle, setPostTitle] = useState('');
    const [sending, setSending] = useState(false);
    const [importJson, setImportJson] = useState('');
    const [importStatus, setImportStatus] = useState<string | null>(null);
    const dialog = useRef<HTMLDialogElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const setFile = useCallback(webhookImplementation.setFile, []);
    const getFile = useCallback(webhookImplementation.getFile, []);
    const getFileName = useCallback(webhookImplementation.getFileName, []);

    const stateKey = useMemo(() => ['data'] as const, []);

    const passProps = useMemo(
        (): PassProps => ({
            getFile,
            getFileName,
            setFile,
            BetterInput,
            EmojiPicker,
            ColorPicker,
            EmojiShow,
            interactiveDisabled: true,
        }),
        [getFile, getFileName, setFile]
    );

    useEffect(() => {
        const t = setTimeout(() => localStorage.setItem('discord.builders__webhookToken', webhookUrl), 1000);
        return () => clearTimeout(t);
    }, [webhookUrl]);

    let parsed_url: URL | null = null;
    try {
        parsed_url = new URL(webhookUrl);
        if (parsed_url.pathname.startsWith('/api/webhooks/') && parsed_url.hostname === 'discord.com') {
            parsed_url.protocol = 'https:';
            parsed_url.pathname = '/api/v10/webhooks/' + parsed_url.pathname.slice('/api/webhooks/'.length);
        }
        const parsed_query = new URLSearchParams(parsed_url.search);
        parsed_query.set('with_components', 'true');
        parsed_url.search = parsed_query.toString();
    } catch {}

    const errors = useMemo(() => webhookImplementation.getErrors(response), [response]);
    const threadId = useMemo(() => getThreadId(webhookUrl), [webhookUrl]);

    useEffect(() => {
        if (threadId) dispatch(actions.setShowThread());
    }, [threadId, dispatch]);

    const sendMessage = async (threadName?: string) => {
        if (!parsed_url) {
            dispatch(actions.setWebhookResponse({ message: 'URL do webhook inválida' }));
            return;
        }

        setSending(true);
        try {
            webhookImplementation.clean(state);
            const req = await fetch(String(parsed_url), webhookImplementation.prepareRequest(state, threadName));
            if (req.status === 204) {
                dispatch(actions.setWebhookResponse({ status: '204 Success' }));
                return;
            }
            const error_data = await req.json();
            if (error_data?.code === 220001 && dialog.current) {
                dialog.current.showModal();
                dispatch(actions.setWebhookResponse(null));
                return;
            }
            dispatch(actions.setWebhookResponse(error_data));
        } catch (e) {
            dispatch(actions.setWebhookResponse({ message: String(e) }));
        } finally {
            setSending(false);
        }
    };

    const importFromJson = () => {
        try {
            const components = parseImportJson(importJson.trim());
            dispatch(actions.setKey({ key: ['data'], value: components }));
            setImportStatus(`${components.length} componente(s) importado(s).`);
        } catch (e) {
            setImportStatus(e instanceof Error ? e.message : 'Erro ao importar JSON.');
        }
    };

    const handleFileSelect = async (file: File | null) => {
        if (!file) return;
        try {
            const text = await file.text();
            setImportJson(text);
            const components = parseImportJson(text.trim());
            dispatch(actions.setKey({ key: ['data'], value: components }));
            setImportStatus(`${components.length} componente(s) importado(s) de ${file.name}.`);
        } catch (e) {
            setImportStatus(e instanceof Error ? e.message : 'Erro ao ler o arquivo.');
        }
    };

  return (
        <div className={styles.layout}>
            <div className={styles.builderCard}>
                <div className={styles.cardHeader}>
                    <h2>Component Builder</h2>
                    <span>Components V2 · arraste e edite</span>
                </div>
                <div className={styles.builder}>
                    <ErrorBoundary fallback={<div className={styles.error}>Erro ao carregar o builder</div>}>
                        <Capsule
                            state={state}
                            stateKey={stateKey}
                            stateManager={stateManager}
                            passProps={passProps}
                            errors={errors}
                        />
                    </ErrorBoundary>
                </div>
            </div>

            <div className={styles.sidePanel}>
                <div className={styles.card}>
                    <h3>Webhook</h3>
                    <label className={styles.label}>URL do Webhook</label>
                    <input
                        className={styles.input}
                        value={webhookUrl}
                        onChange={(e) => dispatch(actions.setWebhookUrl(e.target.value))}
                        placeholder="https://discord.com/api/webhooks/..."
                    />

                    {showThread && (
                        <>
                            <label className={styles.label}>Thread ID (opcional)</label>
                            <input
                                className={styles.input}
                                value={threadId || ''}
                                onChange={(e) => dispatch(actions.setThreadId(e.target.value))}
                                placeholder="ID do tópico do fórum"
                            />
                        </>
                    )}

                    <button className={styles.primaryBtn} disabled={sending || !webhookUrl} onClick={() => sendMessage()}>
                        {sending ? 'Enviando...' : 'Enviar para Discord'}
                    </button>

                    <p className={styles.hint}>
                        Webhooks normais só aceitam botões com link. Botões interativos e menus são removidos
                        automaticamente ao enviar.
                    </p>
                </div>

                <div className={styles.card}>
                    <h3>Resposta</h3>
                    <pre className={styles.response}>
                        {response ? JSON.stringify(response, null, 2) : 'Nenhum envio ainda.'}
                    </pre>
                </div>

                <div className={styles.card}>
                    <h3>Importar JSON</h3>
                    <p className={styles.hint}>
                        Cole o JSON dos components ou o payload completo do webhook.
                    </p>
                    <textarea
                        className={styles.textarea}
                        value={importJson}
                        onChange={(e) => {
                            setImportJson(e.target.value);
                            setImportStatus(null);
                        }}
                        placeholder={'[\n  { "type": 17, "components": [...] }\n]'}
                        rows={8}
                    />
                    <div className={styles.importActions}>
                        <button
                            className={styles.primaryBtn}
                            disabled={!importJson.trim()}
                            onClick={importFromJson}
                        >
                            Importar
                        </button>
                        <button
                            className={styles.ghostBtn}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            Arquivo .json
                        </button>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,application/json"
                        className={styles.hiddenFile}
                        onChange={(e) => {
                            handleFileSelect(e.target.files?.[0] ?? null);
                            e.target.value = '';
                        }}
                    />
                    {importStatus && (
                        <p className={importStatus.includes('importado') ? styles.importOk : styles.importError}>
                            {importStatus}
                        </p>
                    )}
                </div>
            </div>

            <dialog ref={dialog} className={styles.dialog}>
                <h3>Nome do post no fórum</h3>
                <input
                    className={styles.input}
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    placeholder="Título do post"
                />
                <div className={styles.dialogActions}>
                    <button className={styles.ghostBtn} onClick={() => dialog.current?.close()}>
                        Cancelar
                    </button>
                    <button
                        className={styles.primaryBtn}
                        onClick={() => {
                            if (!postTitle) return;
                            dialog.current?.close();
                            sendMessage(postTitle);
                        }}
                    >
                        Enviar
                    </button>
                </div>
            </dialog>
        </div>
    );
}
