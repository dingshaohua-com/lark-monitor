// import React from 'react';
import router from './router';
import '@/assets/styles/golbal.css';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

const root = ReactDOM.createRoot(document.querySelector('#root')!);
root.render(
  // <React.StrictMode>
    <RouterProvider router={router} />
  // </React.StrictMode>,
);