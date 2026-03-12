import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { message } from 'antd';

axios.interceptors.response.use(
  (response) => {
    const res = response.data;
    if (res.code === 1) {
      message.error(res.msg);
      return Promise.reject(res.msg);
    } else {
      return res.data;
    }
  },
  (error) => {
    return Promise.reject(error);
  },
);


// 类型工具：提取 API 响应中 data 字段的类型
type ExtractDataType<T> = T extends { data: infer D } ? D : T;

export const customAxiosInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<ExtractDataType<T>> => {
  // 直接返回 axios 调用的结果
  // 响应拦截器已经处理了数据解构，返回的就是最终的业务数据
  return axios({
    ...config,
    ...options,
    baseURL: import.meta.env.VITE_API_BASE_URL,
  }) as Promise<ExtractDataType<T>>;
};