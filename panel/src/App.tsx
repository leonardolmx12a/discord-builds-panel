import styles from './App.module.css';
import WebhookTab from './tabs/WebhookTab';

export default function App() {
    return (
        <div className={styles.shell}>
            <aside className={styles.sidebar}>
                <div className={styles.brand}>
                    <div className={styles.brandIcon}>⚡</div>
                    <div>
                        <div className={styles.brandTitle}>Discord Builds Panel</div>
                        <div className={styles.brandSub}>Webhook builder</div>
                    </div>
                </div>

                <div className={styles.sidebarFooter}>
                    <span className={styles.dot} />
                    Painel local · v1.0
                </div>
            </aside>

            <main className={styles.main}>
                <header className={styles.header}>
                    <div>
                        <h1>Discord Webhook</h1>
                        <p>Builder + envio</p>
                    </div>
                </header>

                <section className={styles.content}>
                    <WebhookTab />
                </section>
            </main>
        </div>
    );
}
