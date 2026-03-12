import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import router from './router';
import '@/assets/styles/golbal.css';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

dayjs.locale('zh-cn');

const root = ReactDOM.createRoot(document.querySelector('#root')!);
root.render(<RouterProvider router={router} />);