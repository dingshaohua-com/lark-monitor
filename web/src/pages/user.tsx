import { useEffect, useState } from 'react';
import { Button, Table, Modal, Descriptions } from 'antd';
import * as userApi from '@/api/endpoints/user';
import type { UserResponse } from '@/api/model';

export default function UserPage() {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<UserResponse | null>(null);
  const [open, setOpen] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const data = await userApi.getAllApiUserGet();
    setUsers(data);
    setLoading(false);
  };

  const fetchDetail = async (id: number) => {
    const data = await userApi.getByIdApiUserUserIdGet(id);
    setDetail(data);
    setOpen(true);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '用户名', dataIndex: 'name', key: 'name' },
    { title: '年龄', dataIndex: 'age', key: 'age', width: 80 },
    {
      title: '操作', key: 'action', width: 120,
      render: (_: unknown, record: UserResponse) => (
        <Button type="link" onClick={() => fetchDetail(record.id)}>查看详情</Button>
      ),
    },
  ];

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">用户管理</h2>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={users}
        loading={loading}
        pagination={false}
        size="middle"
      />

      <Modal
        title="用户详情"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
      >
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
            <Descriptions.Item label="用户名">{detail.name}</Descriptions.Item>
            <Descriptions.Item label="年龄">{detail.age}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
