import { EyeOutlined, ReloadOutlined, RobotOutlined, SearchOutlined } from '@ant-design/icons';
import { useTableScrolly } from '@/components/use-table-scrolly';
import { Button, Card, Col, DatePicker, Descriptions, Form, Input, Modal, Pagination, Row, Select, Space, Table, Tag, Timeline, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDictApiDictDetailGet } from '@/api/endpoints/dict';
import { getAllApiRawMsgGet, getRepliesApiRawMsgMessageIdRepliesGet } from '@/api/endpoints/raw-msg';
import type { GetAllApiRawMsgGetParams } from '@/api/model';

const { RangePicker } = DatePicker;

const PRIORITY_COLOR: Record<string, string> = {
  P0: 'red',
  P1: 'volcano',
  P2: 'orange',
  P3: 'blue',
  P4: 'default',
};

const MSG_TYPE_MAP: Record<string, { label: string; color: string }> = {
  text: { label: '文本', color: 'blue' },
  post: { label: '富文本', color: 'purple' },
  interactive: { label: '卡片', color: 'orange' },
  image: { label: '图片', color: 'green' },
};

const TAG_KEYS = ['tag_l1', 'tag_l2', 'tag_l3'];

const priorityOptions = [
  { label: 'P0', value: 'P0' },
  { label: 'P1', value: 'P1' },
  { label: 'P2', value: 'P2' },
  { label: 'P3', value: 'P3' },
  { label: 'P4', value: 'P4' },
];

type WorkOrderQuery = GetAllApiRawMsgGetParams;
type WorkOrderDict = Record<string, string>;

interface ParsedFieldItem {
  key?: string;
  label?: string;
  value?: string;
}

interface MessageItem {
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

interface WorkOrderListData {
  items: MessageItem[];
  total: number;
  page: number;
  page_size: number;
}

interface WorkOrderListResponse {
  data: WorkOrderListData;
}

interface ReplyListData {
  message_id: string;
  items: MessageItem[];
  total: number;
}

interface ReplyListResponse {
  data: ReplyListData;
}

const getParsedFieldMap = (message?: MessageItem | null): Record<string, string> => {
  const parsedContent = message?.ext?.parsedContent;
  if (Array.isArray(parsedContent)) {
    return parsedContent.reduce<Record<string, string>>((acc, item) => {
      if (item?.key) {
        acc[item.key] = item.value ?? '';
      }
      return acc;
    }, {});
  }
  if (parsedContent && typeof parsedContent === 'object') {
    return Object.entries(parsedContent).reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value == null ? '' : String(value);
      return acc;
    }, {});
  }
  return {};
};

const getParsedText = (message?: MessageItem | null): string => {
  const parsedContent = message?.ext?.parsedContent;
  if (typeof parsedContent === 'string') {
    return parsedContent;
  }
  if (Array.isArray(parsedContent)) {
    return parsedContent
      .map((item) => item?.value?.trim())
      .filter(Boolean)
      .join('\n');
  }
  if (parsedContent && typeof parsedContent === 'object') {
    return Object.values(parsedContent)
      .map((value) => (value == null ? '' : String(value).trim()))
      .filter(Boolean)
      .join('\n');
  }
  return '';
};

const renderReplyContent = (message?: MessageItem | null, isAppCard?: boolean) => {
  const parsedContent = message?.ext?.parsedContent;
  if ((message?.ext?.typeDetail === 'reply_interactive' || message?.ext?.typeDetail === 'reply_post') && typeof parsedContent === 'string') {
    return <div dangerouslySetInnerHTML={{ __html: parsedContent }} />;
  }
  const text = getParsedText(message) || '-';
  if (text) {
    return (
      <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.04)', borderRadius: 6, fontSize: 13, lineHeight: 1.6 }}>
        {text}
      </div>
    );
  }
  return text;
};

const renderFieldValue = (fieldKey: string, value: string) => {
  if (!value) return '-';
  if (fieldKey === 'priority') {
    return <Tag color={PRIORITY_COLOR[value] ?? 'default'}>{value}</Tag>;
  }
  if (fieldKey === 'online_version_url') {
    return <a href={value} target="_blank" rel="noopener noreferrer">点此查看</a>;
  }
  return value;
};

export default function WorkOrder() {
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MessageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [workOrderDict, setWorkOrderDict] = useState<WorkOrderDict>({});
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<MessageItem | null>(null);
  const { ref: tableWrapRef, scrollY } = useTableScrolly();

  const buildFilters = (): WorkOrderQuery => {
    const values = form.getFieldsValue();
    const filters: WorkOrderQuery = {};
    if (values.keyword?.trim()) filters.keyword = values.keyword.trim();
    if (values.priority) filters.priority = values.priority;
    if (values.dateRange?.[0]) filters.start_date = values.dateRange[0].format('YYYY-MM-DD');
    if (values.dateRange?.[1]) filters.end_date = values.dateRange[1].format('YYYY-MM-DD');
    if (values.has_bot_reply) filters.has_bot_reply = values.has_bot_reply;
    return filters;
  };

  const fetchDict = useCallback(async () => {
    const data = await getDictApiDictDetailGet({ name: 'work_order_map' });
    setWorkOrderDict((data ?? {}) as WorkOrderDict);
  }, []);

  const fetchData = useCallback(async (p: number, size: number, filters: WorkOrderQuery = {}) => {
    setLoading(true);
    try {
      const res = await getAllApiRawMsgGet({ ...filters, page: p, page_size: size }) as WorkOrderListResponse;
      const data = res.data;
      setItems(data?.items ?? []);
      setTotal(data?.total ?? 0);
      setPage(data?.page ?? p);
      setPageSize(data?.page_size ?? size);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDict();
    fetchData(1, pageSize);
  }, [fetchData, fetchDict]);

  const onSearch = () => {
    setPage(1);
    fetchData(1, pageSize, buildFilters());
  };

  const onReset = () => {
    form.resetFields();
    setPage(1);
    fetchData(1, pageSize);
  };

  const onPageChange = (nextPage: number, nextPageSize: number) => {
    setPage(nextPage);
    setPageSize(nextPageSize);
    fetchData(nextPage, nextPageSize, buildFilters());
  };

  const openDetail = async (item: MessageItem) => {
    setDetailOpen(true);
    setDetail(item);
    setDetailLoading(true);
    try {
      const res = await getRepliesApiRawMsgMessageIdRepliesGet(item.message_id) as ReplyListResponse;
      setDetail({ ...item, replies: res.data?.items ?? [] });
    } finally {
      setDetailLoading(false);
    }
  };

  const columns: ColumnsType<MessageItem> = [
    {
      title: '优先级',
      width: 80,
      align: 'center',
      render: (_, record) => {
        const priority = getParsedFieldMap(record).priority;
        if (!priority) return '-';
        return <Tag color={PRIORITY_COLOR[priority] ?? 'default'}>{priority}</Tag>;
      },
    },
    {
      title: '用户原文',
      width: 220,
      ellipsis: true,
      render: (_, record) => getParsedFieldMap(record).user_content || getParsedText(record) || '-',
    },
    {
      title: '分类',
      width: 100,
      render: (_, record) => getParsedFieldMap(record).category || '-',
    },
    {
      title: '标签',
      key: 'tags',
      width: 180,
      ellipsis: true,
      render: (_, record) => {
        const fields = getParsedFieldMap(record);
        const tags = [fields.tag_l1, fields.tag_l2, fields.tag_l3].filter(Boolean);
        return tags.join(' / ') || '-';
      },
    },
    {
      title: '客户端',
      width: 110,
      ellipsis: true,
      render: (_, record) => getParsedFieldMap(record).client_type || '-',
    },
    {
      title: '反馈时间',
      width: 160,
      render: (_, record) => getParsedFieldMap(record).feedback_time || '-',
    },
    {
      title: '机器人参与',
      width: 100,
      align: 'center',
      render: (_, record) =>
        record.ext?.isRepliedByBot ? (
          <Tag icon={<RobotOutlined />} color="processing">是</Tag>
        ) : (
          <span style={{ color: token.colorTextQuaternary }}>否</span>
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => void openDetail(record)}>
          查看
        </Button>
      ),
    },
  ];

  const detailFields = useMemo(() => getParsedFieldMap(detail), [detail]);
  const detailReplies = detail?.replies ?? [];
  const detailFieldEntries = useMemo(
    () => {
      let entries: [string, string][] = [];
      if (Object.keys(workOrderDict).length > 0) {
        entries = Object.entries(workOrderDict)
          .filter(([, fieldKey]) => fieldKey !== 'user_content' && !TAG_KEYS.includes(fieldKey) && Boolean(detailFields[fieldKey]));
      } else {
        const parsedContent = Array.isArray(detail?.ext?.parsedContent) ? detail.ext.parsedContent : [];
        entries = parsedContent
          .filter((item) => item?.key && item.key !== 'user_content' && !TAG_KEYS.includes(item.key ?? '') && item.value)
          .map((item) => [item.label ?? item.key ?? '', item.key ?? ''] as [string, string]);
      }
      const tagsMerged = [detailFields.tag_l1, detailFields.tag_l2, detailFields.tag_l3].filter(Boolean).join(' / ');
      if (tagsMerged) {
        entries.push(['标签', '__tags']);
      }
      return entries;
    },
    [detail, detailFields, workOrderDict],
  );
  const detailTitle = detailFields.user_content || '工单详情';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'hidden' }}>
      <Card size="small" style={{ borderRadius: token.borderRadiusLG, flexShrink: 0 }} className="!py-2">
        <Form form={form} onFinish={onSearch}>
          <Row gutter={[16, 16]} align="middle">
            <Col span={6}>
              <Form.Item name="keyword" label="关键字" style={{ marginBottom: 0 }}>
                <Input placeholder="搜索用户原文..." allowClear />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="dateRange" label="反馈日期" style={{ marginBottom: 0 }}>
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={3}>
              <Form.Item name="priority" label="优先级" style={{ marginBottom: 0 }}>
                <Select placeholder="全部" options={priorityOptions} allowClear />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="has_bot_reply" label="机器人参与" style={{ marginBottom: 0 }}>
                <Select placeholder="全部" allowClear options={[{ label: '是', value: 'yes' }, { label: '否', value: 'no' }]} />
              </Form.Item>
            </Col>
            <Col span={4} style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button icon={<SearchOutlined />} type="primary" htmlType="submit">查询</Button>
              <Button icon={<ReloadOutlined />} onClick={onReset}>重置</Button>
            </Col>
          </Row>
        </Form>
      </Card>
      <Card
        size="small"
        style={{
          borderRadius: token.borderRadiusLG,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        styles={{ body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', paddingTop: 0 } }}
        className="!py-8"
        title={<span style={{ fontSize: 15, fontWeight: 600 }}>工单列表</span>}
        extra={<Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => fetchData(page, pageSize, buildFilters())} />}
      >
        <div ref={tableWrapRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }} className="mt-8">
          <Table<MessageItem>
            rowKey="message_id"
            columns={columns}
            dataSource={items}
            loading={loading}
            tableLayout="fixed"
            scroll={{ y: scrollY }}
            pagination={false}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0, paddingTop: 12 }}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            size="small"
            showSizeChanger
            showTotal={(t) => `共 ${t} 条`}
            pageSizeOptions={[10, 20, 50, 100]}
            onChange={onPageChange}
          />
        </div>
      </Card>

      <Modal
        title={detailTitle}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>}
        width={800}
        destroyOnHidden
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Descriptions column={2} size="small" bordered labelStyle={{ whiteSpace: 'nowrap', width: 92 }}>
              <Descriptions.Item label="工单ID" span={2}>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{detail.message_id}</span>
              </Descriptions.Item>
              {detailFieldEntries.map(([label, fieldKey]) => (
                <Descriptions.Item key={fieldKey} label={label} span={fieldKey === 'cs_remark' ? 2 : 1}>
                  {renderFieldValue(fieldKey, fieldKey === '__tags' ? [detailFields.tag_l1, detailFields.tag_l2, detailFields.tag_l3].filter(Boolean).join(' / ') : detailFields[fieldKey])}
                </Descriptions.Item>
              ))}
            </Descriptions>

            <Card size="small" title="用户原文" style={{ borderRadius: token.borderRadiusLG }}>
              <div style={{ maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.8 }}>
                {detailFields.user_content || '-'}
              </div>
            </Card>

            <Card
              size="small"
              title={`回复 (${detailReplies.length})`}
              style={{ borderRadius: token.borderRadiusLG }}
              styles={{ body: { maxHeight: 300, overflowY: 'auto' } }}
            >
              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: 16, color: token.colorTextQuaternary }}>加载中...</div>
              ) : detailReplies.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 16, color: token.colorTextQuaternary }}>暂无回复</div>
              ) : (
                <Timeline
                  items={detailReplies.map((reply) => ({
                    children: (
                      <div>
                        <Space size={8} style={{ marginBottom: 4 }}>
                          <Tag color={reply.sender?.sender_type === 'user' ? 'processing' : 'default'}>{reply.sender?.sender_type ?? '-'}</Tag>
                          <Tag color={MSG_TYPE_MAP[reply.msg_type ?? '']?.color ?? 'default'}>{MSG_TYPE_MAP[reply.msg_type ?? '']?.label ?? reply.msg_type ?? '-'}</Tag>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, color: token.colorTextSecondary }}>{reply.create_time}</span>
                        </Space>
                        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.6 }}>
                          {renderReplyContent(reply, reply.msg_type === 'interactive' && reply.sender?.sender_type === 'app')}
                        </div>
                      </div>
                    ),
                  }))}
                />
              )}
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}
