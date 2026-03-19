import { BarChartOutlined, CheckOutlined, DownloadOutlined, MessageOutlined } from '@ant-design/icons';
import { Button, Card, Checkbox, DatePicker, Space, theme } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { customAxiosInstance } from '@/api/api.base';

const { RangePicker } = DatePicker;

interface ExportResponse {
  data: {
    items: unknown[];
    total: number;
  };
}

interface StatsResponse {
  data: {
    current: {
      total: number;
      bot_replied: number;
      upvote_total: number;
      downvote_total: number;
      issue_counts: Record<string, number>;
    };
    previous: {
      total: number;
      bot_replied: number;
      upvote_total: number;
      downvote_total: number;
      issue_counts: Record<string, number>;
    };
    period_days: number;
  };
}

function triggerDownload(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Export() {
  const { token } = theme.useToken();
  const today = dayjs();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([today.subtract(6, 'day'), today]);
  const [withReply, setWithReply] = useState(true);
  const [withStats, setWithStats] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{ count: number; filename: string } | null>(null);

  const canExport = dateRange?.[0] && dateRange?.[1];

  const handleExport = async () => {
    if (!canExport) return;
    setLoading(true);
    setLastResult(null);
    try {
      const params: Record<string, string> = {
        start_date: dateRange[0].format('YYYY-MM-DD'),
        end_date: dateRange[1].format('YYYY-MM-DD'),
      };
      if (withReply) params.with_reply = 'true';

      const res = (await customAxiosInstance<unknown>(
        { url: '/api/raw-msg/', method: 'GET', params },
      )) as ExportResponse;

      const items = res.data?.items ?? [];
      let exportData: unknown = items;

      if (withStats) {
        const statsRes = (await customAxiosInstance<unknown>(
          { url: '/api/raw-msg/stats', method: 'GET', params: { start_date: params.start_date, end_date: params.end_date } },
        )) as StatsResponse;
        exportData = { statistics: statsRes.data, items };
      }

      const filename = `工单导出_${params.start_date}_${params.end_date}${withReply ? '_含回复' : ''}.json`;
      triggerDownload(exportData, filename);
      setLastResult({ count: items.length, filename });
    } catch {
      /* handled by interceptor */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', overflow: 'auto' }}>
      <Card style={{ borderRadius: token.borderRadiusLG, width: '100%', maxWidth: 480 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>导出工单数据</div>

        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>
              选择日期范围 <span style={{ color: token.colorError }}>*</span>
            </div>
            <RangePicker
              value={dateRange}
              onChange={(v) => setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null)}
              style={{ width: '100%' }}
              allowClear={false}
            />
          </div>

          <Space direction="vertical" size={8}>
            <Checkbox
              checked={withReply}
              onChange={(e) => setWithReply(e.target.checked)}
            >
              <Space size={4}>
                <MessageOutlined />
                <span>包含对应回复</span>
              </Space>
            </Checkbox>
            <Checkbox
              checked={withStats}
              onChange={(e) => setWithStats(e.target.checked)}
            >
              <Space size={4}>
                <BarChartOutlined />
                <span>导出统计信息</span>
              </Space>
            </Checkbox>
          </Space>

          <Button
            type="primary"
            size="large"
            icon={<DownloadOutlined />}
            loading={loading}
            disabled={!canExport}
            onClick={handleExport}
            style={{ width: '100%' }}
          >
            {loading ? '正在导出...' : '导出 JSON'}
          </Button>

          {lastResult && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                borderRadius: token.borderRadiusLG,
                background: token.colorSuccessBg,
                color: token.colorSuccess,
                fontSize: 13,
              }}
            >
              <CheckOutlined />
              <span>已导出 {lastResult.count} 条工单 → {lastResult.filename}</span>
            </div>
          )}
        </Space>
      </Card>
    </div>
  );
}
