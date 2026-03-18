import { ArrowDownOutlined, ArrowUpOutlined, DislikeOutlined, LikeOutlined, LineChartOutlined, MinusOutlined, RobotOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Card, DatePicker, Empty, Spin, theme } from 'antd';
import dayjs from 'dayjs';
import * as echarts from 'echarts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { customAxiosInstance } from '@/api/api.base';

const { RangePicker } = DatePicker;

interface PeriodStats {
  total: number;
  bot_replied: number;
  upvote_total: number;
  downvote_total: number;
}

interface StatsData {
  current: PeriodStats;
  previous: PeriodStats;
  period_days: number;
}

const fetchStats = (params: { start_date?: string; end_date?: string }) =>
  customAxiosInstance<unknown>({ url: '/api/raw-msg/stats', method: 'GET', params }) as Promise<{ data: StatsData }>;

function calcRate(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function useGauge(rate: number, color: string, bgColor: string) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current);
    }
    chartRef.current.setOption({
      series: [
        {
          type: 'gauge',
          startAngle: 90,
          endAngle: -270,
          radius: '88%',
          pointer: { show: false },
          progress: {
            show: true,
            overlap: false,
            roundCap: true,
            clip: false,
            width: 10,
            itemStyle: { color },
          },
          axisLine: { lineStyle: { width: 10, color: [[1, bgColor]] } },
          splitLine: { show: false },
          axisTick: { show: false },
          axisLabel: { show: false },
          title: { show: false },
          detail: {
            fontSize: 26,
            fontWeight: 700,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color,
            formatter: '{value}%',
            offsetCenter: [0, '0%'],
          },
          data: [{ value: rate }],
          animationDuration: 800,
        },
      ],
    });
  }, [rate, color, bgColor]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const ro = new ResizeObserver(() => chart.resize());
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return ref;
}

interface MetricCardProps {
  title: string;
  icon: React.ReactNode;
  rate: number;
  prevRate: number;
  subtitle: string;
  color: string;
  bgColor: string;
}

function MetricCard({ title, icon, rate, prevRate, subtitle, color, bgColor }: MetricCardProps) {
  const { token } = theme.useToken();
  const gaugeRef = useGauge(rate, color, bgColor);
  const diff = Math.round((rate - prevRate) * 10) / 10;
  const isUp = diff > 0;

  return (
    <Card
      style={{ borderRadius: token.borderRadiusLG, height: '100%' }}
      styles={{ body: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px 20px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 15, fontWeight: 600, color: token.colorTextHeading }}>
        {icon}
        <span>{title}</span>
      </div>
      <div ref={gaugeRef} style={{ width: '100%', maxWidth: 180, aspectRatio: '1' }} />
      <div style={{ marginTop: 8, fontSize: 13, color: token.colorTextSecondary }}>{subtitle}</div>
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
        <span style={{ color: token.colorTextTertiary }}>较上周期</span>
        {diff === 0 ? (
          <span style={{ color: token.colorTextSecondary, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <MinusOutlined style={{ fontSize: 11 }} /> 持平
          </span>
        ) : (
          <span
            style={{
              color: isUp ? (color === token.colorError ? token.colorError : token.colorSuccess) : (color === token.colorError ? token.colorSuccess : token.colorError),
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              fontWeight: 600,
            }}
          >
            {isUp ? <ArrowUpOutlined style={{ fontSize: 11 }} /> : <ArrowDownOutlined style={{ fontSize: 11 }} />}
            {Math.abs(diff)}%
          </span>
        )}
      </div>
    </Card>
  );
}

export default function Home() {
  const { token } = theme.useToken();
  const today = dayjs();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([today.subtract(6, 'day'), today]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);

  const load = useCallback(async (range: [dayjs.Dayjs, dayjs.Dayjs]) => {
    setLoading(true);
    try {
      const res = await fetchStats({
        start_date: range[0].format('YYYY-MM-DD'),
        end_date: range[1].format('YYYY-MM-DD'),
      });
      setStats(res.data);
    } catch {
      /* handled by interceptor */
    } finally {
      setLoading(false);
    }
  }, []);

  // 默认不自动查询，用户点击查询按钮后触发

  const cur = stats?.current ?? { total: 0, bot_replied: 0, upvote_total: 0, downvote_total: 0 };
  const prev = stats?.previous ?? { total: 0, bot_replied: 0, upvote_total: 0, downvote_total: 0 };

  const botRate = calcRate(cur.bot_replied, cur.total);
  const prevBotRate = calcRate(prev.bot_replied, prev.total);

  const curVotes = cur.upvote_total + cur.downvote_total;
  const prevVotes = prev.upvote_total + prev.downvote_total;

  const upRate = calcRate(cur.upvote_total, curVotes);
  const prevUpRate = calcRate(prev.upvote_total, prevVotes);

  const downRate = calcRate(cur.downvote_total, curVotes);
  const prevDownRate = calcRate(prev.downvote_total, prevVotes);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'auto' }}>
      <Card
        size="small"
        style={{ borderRadius: token.borderRadiusLG, flexShrink: 0 }}
        styles={{ body: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' } }}
      >
        <span style={{ fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap' }}>数据分析</span>
        <RangePicker
          size="small"
          value={dateRange}
          onChange={(v) => v && setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
          style={{ maxWidth: 280 }}
          allowClear={false}
        />
        <Button type="primary" size="small" icon={<SearchOutlined />} loading={loading} onClick={() => load(dateRange)}>
          查询
        </Button>
        {stats && (
          <span style={{ marginLeft: 'auto', color: token.colorTextTertiary, fontSize: 13 }}>
            当前周期 {stats.period_days} 天 · 共 {cur.total} 条工单
          </span>
        )}
      </Card>

      {stats ? (
        <Spin spinning={loading}>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <MetricCard
                title="机器人参与率"
                icon={<RobotOutlined style={{ color: token.colorPrimary }} />}
                rate={botRate}
                prevRate={prevBotRate}
                subtitle={`${cur.bot_replied} / ${cur.total} 工单`}
                color={token.colorPrimary}
                bgColor={token.colorPrimaryBg}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <MetricCard
                title="回复正确率"
                icon={<LikeOutlined style={{ color: token.colorSuccess }} />}
                rate={upRate}
                prevRate={prevUpRate}
                subtitle={`${cur.upvote_total} / ${curVotes} 投票`}
                color={token.colorSuccess}
                bgColor={token.colorSuccessBg}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <MetricCard
                title="回复错误率"
                icon={<DislikeOutlined style={{ color: token.colorError }} />}
                rate={downRate}
                prevRate={prevDownRate}
                subtitle={`${cur.downvote_total} / ${curVotes} 投票`}
                color={token.colorError}
                bgColor={token.colorErrorBg}
              />
            </div>
          </div>
        </Spin>
      ) : (
        <Card style={{ borderRadius: token.borderRadiusLG, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty
            image={<LineChartOutlined style={{ fontSize: 48, color: token.colorTextQuaternary }} />}
            description={<span style={{ color: token.colorTextTertiary }}>选择日期范围后点击「查询」查看分析数据</span>}
          />
        </Card>
      )}
    </div>
  );
}
