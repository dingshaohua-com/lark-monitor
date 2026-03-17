import type { GetAllApiRawMsgGetParams } from '@/api/model';

export type WorkOrderQuery = GetAllApiRawMsgGetParams;
export type WorkOrderDict = Record<string, string>;

export interface ParsedFieldItem {
  key?: string;
  label?: string;
  value?: string;
}

export interface MessageItem {
  message_id: string;
  msg_type?: string;
  create_time?: string;
  thread_message_count?: number;
  sender?: {
    sender_type?: string;
  };
  ext?: {
    parsedContent?: ParsedFieldItem[] | string | Record<string, unknown>;
    typeDetail?: string;
    isRepliedByBot?: boolean;
  };
  replies?: MessageItem[];
}

export interface WorkOrderListData {
  items: MessageItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface WorkOrderListResponse {
  data: WorkOrderListData;
}

export interface ReplyListData {
  message_id: string;
  items: MessageItem[];
  total: number;
}

export interface ReplyListResponse {
  data: ReplyListData;
}
