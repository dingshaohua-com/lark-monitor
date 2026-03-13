import { SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Card, DatePicker, Space, Spin } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { getMsgsApiLarkMsgGet } from '@/api/endpoints/lark-msg';

const { RangePicker } = DatePicker;

export default function LarkMsg() {
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
    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
      {/* 搜索条件 */}
      <Card title="搜索条件" className="shrink-0">
        <Space wrap align="center">
          <RangePicker
            value={dateRange}
            onChange={(v) => v && setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
            disabled={loading}
            className="max-w-[280px]"
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
      <div className="flex-1 min-h-0 overflow-auto flex flex-col">
        {loading && (
          <div className="flex-1 flex items-center justify-center min-h-[200px]">
            <Space size="middle" className="text-base">
              <Spin size="large" />
              <span className="text-gray-500">加载中…</span>
            </Space>
          </div>
        )}

        {error && (
          <Alert type="error" showIcon message={error} className="mb-4 shrink-0" />
        )}

        {!loading && data === null && !error && (
          <div className="flex-1 flex items-center justify-center min-h-[200px]">
            <p className="text-center text-gray-500 text-sm px-12">
              选择日期范围后点击「查询」获取消息
            </p>
          </div>
        )}

        {!loading && data !== null && (
          <Card
            size="small"
            title={`共计 ${Array.isArray(data) ? data.length : 1} 条数据`}
            className="flex-1 min-h-0 flex flex-col"
            bodyStyle={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 0 }}
          >
            <div className="h-full overflow-auto">
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
