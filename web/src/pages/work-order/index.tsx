import { EyeOutlined, ReloadOutlined, RobotOutlined, SearchOutlined } from '@ant-design/icons';
import { useTableScrollY } from '@repo/ui-custom/use-table-scroll-y';
import { Button, Card, Col, DatePicker, Descriptions, Form, Input, Modal, Pagination, Row, Select, Space, Table, Tag, Timeline, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { getWorkOrders, type MessageItem, type WorkOrderQuery } from '@/api/message';

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

const priorityOptions = [
  { label: 'P0', value: 'P0' },
  { label: 'P1', value: 'P1' },
  { label: 'P2', value: 'P2' },
  { label: 'P3', value: 'P3' },
  { label: 'P4', value: 'P4' },
];

export default function WorkOrder() {
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MessageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { ref: tableWrapRef, scrollY } = useTableScrollY();

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<MessageItem | null>(null);

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

  const fetchData = useCallback(async (p: number, size: number, filters: WorkOrderQuery = {}) => {
    setLoading(true);
    try {
      const res = await getWorkOrders({ ...filters, page: p, page_size: size });
      const d = res.data.data;
      setItems(d.items);
      setTotal(d.total);
      setPage(d.page);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(1, pageSize);
  }, [fetchData, pageSize]);

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

  const openDetail = (item: MessageItem) => {
    setDetail(item);
    setDetailOpen(true);
  };

  const columns: ColumnsType<MessageItem> = [
    {
      title: '优先级',
      dataIndex: ['content', 'fields', 'priority'],
      width: 80,
      align: 'center',
      render: (v: string) => {
        if (!v) return '-';
        return <Tag color={PRIORITY_COLOR[v] ?? 'default'}>{v}</Tag>;
      },
    },
    {
      title: '用户原文',
      width: 200,
      ellipsis: true,
      render: (_, record) => {
        if (record.sender?.sender_type === 'app') {
          return record.content?.fields?.user_content || '-';
        }
        return record.content?.raw || record.content?.text || '-';
      },
    },
    {
      title: '分类',
      dataIndex: ['content', 'fields', 'category'],
      width: 90,
      render: (v: string) => v || '-',
    },
    {
      title: '标签',
      key: 'tags',
      width: 180,
      ellipsis: true,
      render: (_, record) => {
        const f = record.content?.fields;
        if (!f) return '-';
        const tags = [f.tag_l1, f.tag_l2, f.tag_l3].filter(Boolean);
        return tags.join(' / ') || '-';
      },
    },
    {
      title: '客户端',
      dataIndex: ['content', 'fields', 'client_type'],
      width: 110,
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '反馈时间',
      dataIndex: ['content', 'fields', 'feedback_time'],
      width: 160,
      render: (v: string) => v || '-',
    },
    {
      title: '回复',
      dataIndex: 'reply_count',
      width: 70,
      align: 'center',
      render: (v: number | undefined) =>
        (v ?? 0) > 0 ? (
          <Tag color="purple">{v}</Tag>
        ) : (
          <span style={{ color: token.colorTextQuaternary }}>0</span>
        ),
    },
    {
      title: '机器人参与',
      dataIndex: 'has_bot_reply',
      width: 80,
      align: 'center',
      render: (v: boolean | undefined) =>
        v ? (
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
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
          查看
        </Button>
      ),
    },
  ];

  const detailFields = detail?.content?.fields;
  const isBot = detail?.sender?.sender_type === 'app';
  const replies = detail?.replies ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'hidden' }}>
      <Card size="small" style={{ borderRadius: token.borderRadiusLG, flexShrink: 0 }} className="!py-2">
        <Form form={form} onFinish={onSearch}>
          <Row gutter={[16, 16]} align="middle">
            <Col span={6}>
              <Form.Item name="keyword" label="关键字" style={{ marginBottom: 0 }}>
                <Input placeholder="搜索用户原文/备注..." allowClear />
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
        title={detail?.content?.title ?? '工单详情'}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>}
        width={800}
        destroyOnHidden
      >
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {isBot && detailFields ? (
              <>
                <Descriptions column={2} size="small" bordered labelStyle={{ whiteSpace: 'nowrap', width: 80 }}>
                  <Descriptions.Item label="工单ID" span={2}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{detail.message_id}</span>
                  </Descriptions.Item>
                  <Descriptions.Item label="优先级">
                    <Tag color={PRIORITY_COLOR[detailFields.priority ?? ''] ?? 'default'}>{detailFields.priority ?? '-'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="分类">{detailFields.category ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="客户端">{detailFields.client_type ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="模块">{detailFields.module ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="反馈ID">{detailFields.feedback_id ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="姓名">{detailFields.student_name ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="UID">{detailFields.uid ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="学校">{detailFields.school_name ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="年级/班级">{[detailFields.grade_name, detailFields.class_name].filter(Boolean).join(' / ') || '-'}</Descriptions.Item>
                  <Descriptions.Item label="版本号">{detailFields.app_version ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="设备型号">{detailFields.device_model ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="所属客服">{detailFields.customer_service ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="反馈时间">{detailFields.feedback_time ?? '-'}</Descriptions.Item>
                  {detailFields.cs_remark && (
                    <Descriptions.Item label="客服备注" span={2}>{detailFields.cs_remark}</Descriptions.Item>
                  )}
                  <Descriptions.Item label="标签" span={2}>
                    {(() => {
                      const tags = [detailFields.tag_l1, detailFields.tag_l2, detailFields.tag_l3].filter(Boolean);
                      return tags.length > 0 ? <Space size={4}>{tags.map((t) => <Tag key={t}>{t}</Tag>)}</Space> : '-';
                    })()}
                  </Descriptions.Item>
                  {detailFields.online_version_url && (
                    <Descriptions.Item label="线上版本">
                      <a href={detailFields.online_version_url} target="_blank" rel="noopener noreferrer">点此查看</a>
                    </Descriptions.Item>
                  )}
                </Descriptions>
                <Card size="small" title="用户原文" style={{ borderRadius: token.borderRadiusLG }}>
                  <div style={{ maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.8 }}>
                    {detailFields.user_content || '-'}
                  </div>
                </Card>
              </>
            ) : (
              <Card size="small" title="原始内容" style={{ borderRadius: token.borderRadiusLG }}>
                <div style={{ maxHeight: 300, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.8 }}>
                  {detail.content?.raw || detail.content?.text || '-'}
                </div>
              </Card>
            )}

            <Card
              size="small"
              title={`回复 (${replies.length})`}
              style={{ borderRadius: token.borderRadiusLG }}
              styles={{ body: { maxHeight: 300, overflowY: 'auto' } }}
            >
              {replies.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 16, color: token.colorTextQuaternary }}>暂无回复</div>
              ) : (
                <Timeline
                  items={replies.map((r) => ({
                    children: (
                      <div>
                        <Space size={8} style={{ marginBottom: 4 }}>
                          <Tag color={r.sender?.sender_type === 'user' ? 'processing' : 'default'}>{r.sender?.sender_type ?? '-'}</Tag>
                          <Tag color={MSG_TYPE_MAP[r.msg_type]?.color ?? 'default'}>{MSG_TYPE_MAP[r.msg_type]?.label ?? r.msg_type}</Tag>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, color: token.colorTextSecondary }}>{r.create_time}</span>
                        </Space>
                        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.6 }}>{r.content?.text || '-'}</div>
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
