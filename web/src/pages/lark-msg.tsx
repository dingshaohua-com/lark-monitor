import { SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Card, DatePicker, Space, Spin, theme } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { getMsgsApiLarkMsgGet } from '@/api/endpoints/lark-msg';

const { RangePicker } = DatePicker;

export default function LarkMsg() {
  const { token } = theme.useToken();
  const today = dayjs();

  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([today, today]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<unknown>(null);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMsgsApiLarkMsgGet({
        start: dateRange[0].format('YYYY-MM-DD'),
        end: dateRange[1].format('YYYY-MM-DD'),
      });
      setData(res);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message ?? '请求失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'hidden' }}>
      {/* 搜索条件 */}
      <Card title="搜索条件" style={{ flexShrink: 0 }}>
        <Space wrap align="center">
          <RangePicker
            value={dateRange}
            onChange={(v) => v && setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
            disabled={loading}
            style={{ maxWidth: 280 }}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            loading={loading}
            onClick={handleSearch}
          >
            查询
          </Button>
        </Space>
      </Card>

      {/* 结果展示 */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {loading && (
          <Space style={{ padding: 24 }}>
            <Spin />
            <span>加载中…</span>
          </Space>
        )}

        {error && (
          <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
        )}

        {!loading && data === null && !error && (
          <div
            style={{
              flex: 1,
              padding: 48,
              textAlign: 'center',
              color: token.colorTextDescription,
              fontSize: 14,
            }}
          >
            选择日期范围后点击「查询」获取消息
          </div>
        )}

        {!loading && data !== null && (
          <Card
            size="small"
            title={`共计 ${Array.isArray(data) ? data.length : 1} 条数据`}
            style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 0 }}
          >
            <div style={{ height: '100%', overflow: 'auto' }}>
              <SyntaxHighlighter
                language="json"
                style={oneDark}
                customStyle={{
                  margin: 0,
                  fontSize: 12,
                }}
                showLineNumbers
                wrapLongLines
              >
                {JSON.stringify(data, null, 2)}
              </SyntaxHighlighter>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
