import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Stethoscope } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('Login attempt:', { email, password });

        // Temporary: Simulate successful login
        localStorage.setItem('isAuthenticated', 'true');
        navigate('/dashboard');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-blue-100 p-3 rounded-full mb-4">
                        <Stethoscope className="w-8 h-8 text-blue-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Hospital OS</h1>
                    <p className="text-gray-500 mt-2">의료진 전용 시스템</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input
                        label="이메일"
                        id="email"
                        type="email"
                        placeholder="doctor@hospital.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <Input
                        label="비밀번호"
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />

                    <div className="flex items-center justify-between text-sm">
                        <label className="flex items-center">
                            <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            <span className="ml-2 text-gray-600">로그인 유지</span>
                        </label>
                        <a href="#" className="text-blue-600 hover:text-blue-500 font-medium">
                            비밀번호 찾기
                        </a>
                    </div>

                    <Button type="submit">
                        로그인
                    </Button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-500">
                    계정이 없으신가요? <a href="#" className="text-blue-600 hover:text-blue-500 font-medium">관리자에게 문의</a>
                </div>
            </div>
        </div>
    );
};

export default Login;
