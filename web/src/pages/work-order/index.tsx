import { EyeOutlined, ReloadOutlined, RobotOutlined, SearchOutlined } from '@ant-design/icons';
import { useTableScrolly } from '@/components/use-table-scrolly';
import { Button, Card, Col, DatePicker, Form, Input, Pagination, Row, Select, Table, Tag, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { getDictApiDictDetailGet } from '@/api/endpoints/dict';
import { getAllApiRawMsgGet, getRepliesApiRawMsgMessageIdRepliesGet } from '@/api/endpoints/raw-msg';
import type { ReplyListResponse, WorkOrderListResponse } from './types';
import type { MessageItem, WorkOrderDict, WorkOrderQuery } from './types';
import { PRIORITY_COLOR, priorityOptions } from './constants';
import { formatFeedbackTime, getParsedFieldMap, getParsedText } from './utils';
import { DetailModal } from './detail-modal';

const { RangePicker } = DatePicker;

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
      const res = (await getAllApiRawMsgGet({ ...filters, page: p, page_size: size })) as WorkOrderListResponse;
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
      const res = (await getRepliesApiRawMsgMessageIdRepliesGet(item.message_id)) as ReplyListResponse;
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
      render: (_, record) => formatFeedbackTime(getParsedFieldMap(record).feedback_time, record.create_time),
    },
    {
      title: '问题类型',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const t = record.ext?.issueType as string | undefined;
        if (!t || t === '待定') return <Tag>待定</Tag>;
        if (t === '技术问题') return <Tag color="red">技术</Tag>;
        return <Tag color="green">非技术</Tag>;
      },
    },
    {
      title: '机器人参与',
      width: 100,
      align: 'center',
      render: (_, record) =>
        record.ext?.isRepliedByBot ? (
          <Tag icon={<RobotOutlined />} color={token.colorPrimary}>是</Tag>
        ) : (
          <span style={{ color: token.colorTextQuaternary }}>否</span>
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button type="link" size="small" icon={<EyeOutlined />} style={{ color: token.colorPrimary }} onClick={() => void openDetail(record)}>
          查看
        </Button>
      ),
    },
  ];

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

      <DetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        detail={detail}
        loading={detailLoading}
        workOrderDict={workOrderDict}
      />
    </div>
  );
}
