'use client';

import { useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuthContext } from '@/context/AuthenticationContext';
import Loader from '@/components/Loader';
import ErrorBox from '@/components/ErrorBox';

const CodingPlatformHome = () => {
  const [error, setError] = useState('');
  const router = useRouter();
  const { user, setUser, loading, setLoading } = useAuthContext();

  const checkAuth = async () => {
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_IOICLUB_BACKEND_URL}/api/auth/me`, {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const userData = res.data.data;

      setUser(userData.user);

      // Redirect to dashboard on successful authentication
      if (userData.user.role === 'TEACHER') {
        router.push('/teacher');
      }
      else if (userData.user.role === 'STUDENT') {
        router.push('/coding');
      } else {
        setError('Invalid role selected');
      }

    } catch (error: any) {
      const errorMsg = error.response?.data?.message;
      setError(errorMsg || 'Something went wrong. Please try again.');
    } finally {
      // Always reset loading state
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="h-screen bg-qc-accent/10 flex">
        <ErrorBox message={error} onRetry={checkAuth} />
      </div>
    );
  }

  return (
    <div className="h-screen bg-qc-accent/10 flex">
      {loading && <Loader text="Checking authentication..." />}
    </div>
  );
};

export default CodingPlatformHome;