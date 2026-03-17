import { Button, Card, Descriptions, Modal, Space, Tag, Timeline, theme } from 'antd';
import type { MessageItem } from './types';
import { MSG_TYPE_MAP, TAG_KEYS } from './constants';
import { getParsedFieldMap, renderFieldValue, renderReplyContent } from './utils';

interface DetailModalProps {
  open: boolean;
  onClose: () => void;
  detail: MessageItem | null;
  loading: boolean;
  workOrderDict: Record<string, string>;
}

export function DetailModal({ open, onClose, detail, loading, workOrderDict }: DetailModalProps) {
  const { token } = theme.useToken();
  const detailFields = getParsedFieldMap(detail);
  const detailReplies = detail?.replies ?? [];

  const detailFieldEntries = (() => {
    let entries: [string, string][] = [];
    if (Object.keys(workOrderDict).length > 0) {
      entries = Object.entries(workOrderDict)
        .filter(([, fieldKey]) => fieldKey !== 'user_content' && !TAG_KEYS.includes(fieldKey) && Boolean(detailFields[fieldKey]));
    } else if (detail?.ext?.parsedContent && Array.isArray(detail.ext.parsedContent)) {
      const parsedContent = detail.ext.parsedContent;
      entries = parsedContent
        .filter((item) => item?.key && item.key !== 'user_content' && !TAG_KEYS.includes(item.key ?? '') && item.value)
        .map((item) => [item.label ?? item.key ?? '', item.key ?? ''] as [string, string]);
    }
    const tagsMerged = [detailFields.tag_l1, detailFields.tag_l2, detailFields.tag_l3].filter(Boolean).join(' / ');
    if (tagsMerged) {
      entries.push(['标签', '__tags']);
    }
    return entries;
  })();

  const detailTitle = detailFields.user_content || '工单详情';

  return (
    <Modal
      title={detailTitle}
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
      width={800}
      destroyOnClose
      styles={{
        body: {
          height: '70vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
        },
      }}
    >
      {detail && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', gap: 16, padding: 24 }}>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 24, paddingBottom: 12, borderRadius: token.borderRadiusLG, boxShadow: '0 0 12px rgba(0,0,0,0.1)' }}>
            <Descriptions
              className="work-order-detail-descriptions"
              column={3}
              size="small"
              bordered
              labelStyle={{ whiteSpace: 'nowrap', width: 92 }}
            >
              <Descriptions.Item label="工单ID" span={3}>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{detail.message_id}</span>
              </Descriptions.Item>
              {detailFieldEntries.map(([label, fieldKey]) => (
                <Descriptions.Item key={fieldKey} label={label} span={fieldKey === 'cs_remark' ? 3 : 1}>
                  {renderFieldValue(
                    fieldKey,
                    fieldKey === '__tags'
                      ? [detailFields.tag_l1, detailFields.tag_l2, detailFields.tag_l3].filter(Boolean).join(' / ')
                      : detailFields[fieldKey],
                  )}
                </Descriptions.Item>
              ))}
            </Descriptions>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px', borderRadius: token.borderRadiusLG, boxShadow: '0 0 12px rgba(0,0,0,0.1)' }}>
            <Card size="small" title="用户原文" style={{ borderRadius: token.borderRadiusLG, marginBottom: 20 }}>
              <div style={{ maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.8 }}>
                {detailFields.user_content || '-'}
              </div>
            </Card>
            <Card
              size="small"
              title={`回复 (${detailReplies.length})`}
              style={{ borderRadius: token.borderRadiusLG }}
            >
              {loading ? (
                <div style={{ textAlign: 'center', padding: 16, color: token.colorTextQuaternary }}>加载中...</div>
              ) : detailReplies.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 16, color: token.colorTextQuaternary }}>暂无回复</div>
              ) : (
                <Timeline
                  items={detailReplies.map((reply) => ({
                    children: (
                      <div>
                        <Space size={8} style={{ marginBottom: 4 }}>
                          <Tag color={reply.sender?.sender_type === 'user' ? 'processing' : 'default'}>
                            {reply.sender?.sender_type ?? '-'}
                          </Tag>
                          <Tag color={MSG_TYPE_MAP[reply.msg_type ?? '']?.color ?? 'default'}>
                            {MSG_TYPE_MAP[reply.msg_type ?? '']?.label ?? reply.msg_type ?? '-'}
                          </Tag>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, color: token.colorTextSecondary }}>
                            {reply.create_time}
                          </span>
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
        </div>
      )}
    </Modal>
  );
}
