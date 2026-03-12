import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Form, Input, message } from 'antd';
import { useNavigate } from 'react-router';

type LoginFormValues = {
  account: string;
  password: string;
};

export default function Login() {
  const navigate = useNavigate();
  const [form] = Form.useForm<LoginFormValues>();

  const onLogin = async (values: LoginFormValues) => {
    try {
      console.log('密码登录:', values);
      // TODO: 调用登录 API
      message.success('登录成功');
      navigate('/');
    } catch {
      message.error('登录失败，请检查账号密码');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <div style={{ width: 380, padding: '32px 40px', background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>工单系统</h2>
        </div>
        <Form form={form} onFinish={onLogin} size="large" autoComplete="off">
          <Form.Item name="account" rules={[{ required: true, message: '请输入用户名或邮箱' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名 / 邮箱" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              登录
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
