import { DeleteOutlined, SyncOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, DatePicker, Modal, Progress, Radio, Row, Statistic, theme } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { clearRawMsg, getRawMsgStatus, rebuildOptimize, syncReport, type RawMsgStatus } from '@/api/report';

const { RangePicker } = DatePicker;

type TaskMode = 'idle' | 'running' | 'done' | 'error';

function useTaskProgress() {
  const [mode, setMode] = useState<TaskMode>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode !== 'running') return;
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return 90;
        const step = p < 30 ? 8 : p < 60 ? 4 : 1.5;
        return Math.min(p + step, 90);
      });
    }, 300);
    return () => clearInterval(timer);
  }, [mode]);

  const start = () => { setMode('running'); setProgress(0); setError(''); };
  const done = () => { setProgress(100); setMode('done'); };
  const fail = (msg: string) => { setProgress(0); setError(msg); setMode('error'); };

  return { mode, progress, error, start, done, fail };
}

const formatTime = (v: string | null | undefined) => {
  if (!v) return '暂无记录';
  const ts = Number(v);
  const d = Number.isNaN(ts) ? new Date(v) : new Date(ts.toString().length <= 10 ? ts * 1000 : ts);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
};

export default function SyncData() {
  const { token } = theme.useToken();
  const today = dayjs();
  const [syncMode, setSyncMode] = useState<'continue' | 'range' | 'full'>('continue');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([today, today]);

  const sync = useTaskProgress();
  const rebuild = useTaskProgress();
  const [rebuildDone, setRebuildDone] = useState(false);

  const [status, setStatus] = useState<RawMsgStatus | null>(null);
  const [clearing, setClearing] = useState(false);

  const anyRunning = sync.mode === 'running' || rebuild.mode === 'running' || clearing;

  const fetchStatus = useCallback(async () => {
    try {
      const res = await getRawMsgStatus();
      setStatus(res.data.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleSync = async () => {
    sync.start();
    try {
      const params: { mode: 'continue' | 'range' | 'full'; start?: string; end?: string } = { mode: syncMode };
      if (syncMode === 'range') {
        params.start = dateRange[0].format('YYYY-MM-DD');
        params.end = dateRange[1].format('YYYY-MM-DD');
      }
      await syncReport(params);
      sync.done();
      fetchStatus();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      sync.fail(err?.response?.data?.detail || err.message || '同步失败');
    }
  };

  const handleRebuild = async () => {
    setRebuildDone(false);
    rebuild.start();
    try {
      await rebuildOptimize();
      setRebuildDone(true);
      rebuild.done();
      fetchStatus();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      rebuild.fail(err?.response?.data?.detail || err.message || '重建失败');
    }
  };

  const handleClear = () => {
    Modal.confirm({
      title: '确认删除所有原始数据',
      content: '此操作将删除 raw_msg 和 opt_msg 全部数据，不可恢复。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setClearing(true);
        try {
          await clearRawMsg();
          fetchStatus();
        } finally {
          setClearing(false);
        }
      },
    });
  };

  const progressStatus = (mode: TaskMode) => {
    if (mode === 'running') return 'active';
    if (mode === 'done') return 'success';
    if (mode === 'error') return 'exception';
    return 'normal';
  };

  const cardStyle = { borderRadius: token.borderRadiusLG };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflowX: 'hidden', overflowY: 'auto' }}>
      <Card
        size="small"
        title={<span style={{ fontSize: 15, fontWeight: 600 }}>同步状态</span>}
        extra={
          <Button danger size="small" icon={<DeleteOutlined />} loading={clearing} disabled={anyRunning} onClick={handleClear}>
            删除所有原始数据
          </Button>
        }
        style={cardStyle}
      >
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Card size="small" style={{ background: token.colorBgLayout }}>
              <Statistic
                title="数据总条数"
                value={status ? `${status.total} 条（主消息 ${status.main_count}，回复 ${status.reply_count}）` : '-'}
                valueStyle={{ fontSize: 15 }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ background: token.colorBgLayout }}>
              <Statistic
                title="工单时间范围"
                value={status?.earliest_time ? `${formatTime(status.earliest_time)} ~ ${formatTime(status.latest_time)}` : '-'}
                valueStyle={{ fontSize: 13 }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ background: token.colorBgLayout }}>
              <Statistic
                title="最后同步时间"
                value={formatTime(status?.last_sync_at)}
                valueStyle={{ fontSize: 14 }}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      <Card
        size="small"
        title={<span style={{ fontSize: 15, fontWeight: 600 }}>执行同步</span>}
        extra={
          <Button
            type="primary"
            icon={<SyncOutlined spin={sync.mode === 'running'} />}
            disabled={anyRunning}
            loading={sync.mode === 'running'}
            size="small"
            onClick={() => {
              if (syncMode === 'full') {
                Modal.confirm({
                  title: '确认全量同步',
                  content: '谨慎点击！确定要执行全量同步吗？短则几分钟，长则遥遥无期。',
                  okText: '确认执行',
                  cancelText: '取消',
                  onOk: handleSync,
                });
              } else {
                handleSync();
              }
            }}
          >
            执行同步
          </Button>
        }
        style={cardStyle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Radio.Group value={syncMode} onChange={(e) => setSyncMode(e.target.value)} disabled={anyRunning} size="small">
            <Radio.Button value="continue">从上次续更</Radio.Button>
            <Radio.Button value="range">指定日期</Radio.Button>
            <Radio.Button value="full">全量更新</Radio.Button>
          </Radio.Group>
          {syncMode === 'range' && (
            <RangePicker
              size="small"
              value={dateRange}
              onChange={(v) => v && setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
              disabled={anyRunning}
            />
          )}
        </div>

        {sync.mode !== 'idle' && (
          <Progress percent={Math.round(sync.progress)} status={progressStatus(sync.mode)} style={{ marginTop: 16 }} />
        )}
        {sync.mode === 'error' && (
          <Alert type="error" showIcon message={sync.error} style={{ marginTop: 12 }} />
        )}
        {sync.mode === 'done' && (
          <Alert type="success" showIcon message="同步完成" style={{ marginTop: 12 }} />
        )}
      </Card>

      <Card
        size="small"
        title={<span style={{ fontSize: 15, fontWeight: 600 }}>重建优化数据</span>}
        extra={
          <Button
            size="small"
            icon={<ThunderboltOutlined />}
            disabled={anyRunning}
            loading={rebuild.mode === 'running'}
            onClick={handleRebuild}
          >
            执行重建
          </Button>
        }
        style={cardStyle}
      >
        <div style={{ fontSize: 12, color: token.colorTextTertiary, marginBottom: rebuild.mode !== 'idle' ? 12 : 0 }}>
          从已有原始数据重新解析生成 opt_msg，不会请求飞书接口
        </div>

        {rebuild.mode !== 'idle' && (
          <Progress percent={Math.round(rebuild.progress)} status={progressStatus(rebuild.mode)} />
        )}
        {rebuild.mode === 'error' && (
          <Alert type="error" showIcon message={rebuild.error} style={{ marginTop: 12 }} />
        )}
        {rebuildDone && rebuild.mode === 'done' && (
          <Alert type="success" showIcon message="重建完成" style={{ marginTop: 12 }} />
        )}
      </Card>
    </div>
  );
}
