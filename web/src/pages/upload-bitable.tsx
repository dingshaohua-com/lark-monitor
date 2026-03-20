import {
  CheckCircleOutlined,
  CloudUploadOutlined,
  SettingOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Collapse, DatePicker, Input, Space, Statistic, theme } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { customAxiosInstance } from '@/api/api.base';

const { RangePicker } = DatePicker;

const DEFAULT_APP_TOKEN = 'Sywxb4dh8aeRZJsvD3WcDiXDnnc';
const DEFAULT_TABLE_ID = 'tblt7L2vgw70yE3F';

interface UploadResult {
  total: number;
  uploaded: number;
  failed: number;
  errors: string[];
}

export default function UploadBitable() {
  const { token } = theme.useToken();
  const today = dayjs();

  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([today, today]);
  const [appToken, setAppToken] = useState(DEFAULT_APP_TOKEN);
  const [tableId, setTableId] = useState(DEFAULT_TABLE_ID);

  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const handleUpload = async () => {
    setUploading(true);
    setResult(null);
    try {
      const data = await customAxiosInstance<UploadResult>({
        url: '/api/bitable/upload',
        method: 'POST',
        data: {
          start_date: dateRange[0].format('YYYY-MM-DD'),
          end_date: dateRange[1].format('YYYY-MM-DD'),
          report_date: dateRange[0].format('YYYY-MM-DD'),
          app_token: appToken,
          table_id: tableId,
        },
      });
      setResult(data);
    } catch {
      /* handled by interceptor */
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'auto' }}>
      <Card>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>上传到飞书多维表格</div>

        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>
              日期范围 <span style={{ color: token.colorError }}>*</span>
            </div>
            <RangePicker
              value={dateRange}
              onChange={(v) => v && setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
              style={{ width: '100%' }}
              allowClear={false}
              disabled={uploading}
            />
          </div>

          <Collapse
            size="small"
            ghost
            items={[
              {
                key: '1',
                label: (
                  <Space size={6}>
                    <SettingOutlined style={{ color: token.colorTextSecondary }} />
                    <span style={{ color: token.colorTextSecondary, fontSize: 13 }}>高级配置</span>
                  </Space>
                ),
                children: (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <div>
                      <div style={{ marginBottom: 4, fontSize: 13, color: token.colorTextSecondary }}>
                        多维表格 App Token
                      </div>
                      <Input
                        value={appToken}
                        onChange={(e) => setAppToken(e.target.value)}
                        placeholder="App Token"
                        disabled={uploading}
                      />
                    </div>
                    <div>
                      <div style={{ marginBottom: 4, fontSize: 13, color: token.colorTextSecondary }}>
                        Table ID
                      </div>
                      <Input
                        value={tableId}
                        onChange={(e) => setTableId(e.target.value)}
                        placeholder="Table ID"
                        disabled={uploading}
                      />
                    </div>
                  </Space>
                ),
              },
            ]}
          />

          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            loading={uploading}
            onClick={handleUpload}
            style={{ alignSelf: 'flex-start' }}
          >
            {uploading ? '上传中…' : '上传到多维表格'}
          </Button>
        </Space>
      </Card>

      {result && (
        <Card>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>上传结果</div>

          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div style={{ display: 'flex', gap: 32 }}>
              <Statistic
                title="总计"
                value={result.total}
                suffix="条"
                styles={{ content: { fontSize: 22 } }}
              />
              <Statistic
                title="成功"
                value={result.uploaded}
                suffix="条"
                valueStyle={{ color: token.colorSuccess }}
                styles={{ content: { fontSize: 22 } }}
              />
              <Statistic
                title="失败"
                value={result.failed}
                suffix="条"
                valueStyle={{ color: result.failed > 0 ? token.colorError : undefined }}
                styles={{ content: { fontSize: 22 } }}
              />
            </div>

            {result.failed === 0 ? (
              <Alert
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
                message={`全部 ${result.uploaded} 条上传成功`}
              />
            ) : (
              <Alert
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                message={`成功 ${result.uploaded} 条，失败 ${result.failed} 条`}
              />
            )}

            {result.errors.length > 0 && (
              <div
                style={{
                  maxHeight: 180,
                  overflow: 'auto',
                  padding: '8px 12px',
                  background: token.colorFillAlter,
                  borderRadius: token.borderRadius,
                  fontSize: 12,
                }}
              >
                {result.errors.map((err, i) => (
                  <div
                    key={i}
                    style={{ color: token.colorError, padding: '2px 0', lineHeight: 1.6 }}
                  >
                    {err}
                  </div>
                ))}
              </div>
            )}
          </Space>
        </Card>
      )}
    </div>
  );
}
