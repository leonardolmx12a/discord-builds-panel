import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import 'emoji-mart/css/emoji-mart.css';
import 'components-sdk/components-sdk.css';
import '@website/index.css';
import '@website/slider.css';
import '@website/i18n';
import './index.css';
import App from './App';
import { store } from '@website/state';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Provider store={store}>
            <App />
        </Provider>
    </StrictMode>
);
