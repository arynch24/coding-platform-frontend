"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    FileCode2,
    Trophy,
    Users,
    LogOut,
    Menu,
    X
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import axios from 'axios';
import LogoutDialog from '@/components/LogoutDialog';
import { useAuthContext } from '@/context/AuthenticationContext';

// Define the structure for navigation items
interface NavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    navigation: string;
    hasNestedRoutes?: boolean;
}

const QCAuditSidebar: React.FC = () => {
    // Next.js router for navigation
    const router = useRouter();
    const pathname = usePathname();

    // State to control sidebar visibility on mobile
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // State for logout dialog
    const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const { user } = useAuthContext();

    // Check if screen is mobile and set responsive behavior
    useEffect(() => {
        const checkScreenSize = () => {
            const mobile = window.innerWidth < 768; // md breakpoint
            setIsMobile(mobile);
            // Close mobile menu when switching to desktop
            if (!mobile) {
                setIsMobileMenuOpen(false);
            }
        };

        // Check on initial load
        checkScreenSize();

        // Add event listener for window resize
        window.addEventListener('resize', checkScreenSize);

        // Cleanup event listener on component unmount
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    // Navigation items configuration
    const navigationItems: NavItem[] = [
        {
            id: 'dashboard',
            label: 'Manage Exams ',
            icon: <Trophy size={20} />,
            navigation: '/teacher'
        },
        {
            id: 'questions',
            label: 'Question Bank',
            icon: <FileCode2 size={20} />,
            navigation: '/teacher/question-bank',
        },
        {
            id: 'leaderboard',
            label: 'Leaderboard',
            icon: <Users size={20} />,
            navigation: '/teacher/leaderboard',
            hasNestedRoutes: true
        },
    ];

    /**
     * Check if a navigation item should be active
     */
    const isItemActive = (item: NavItem): boolean => {
        if (item.hasNestedRoutes) {
            return pathname.startsWith(item.navigation);
        }
        return pathname === item.navigation;
    };

    /**
     * Open logout confirmation dialog
     */
    const openLogoutDialog = () => {
        setIsLogoutDialogOpen(true);
    };

    /**
     * Close logout confirmation dialog
     */
    const closeLogoutDialog = () => {
        setIsLogoutDialogOpen(false);
    };

    /**
     * Handle logout functionality with confirmation
     */
    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await axios.post((`${process.env.NEXT_PUBLIC_IOICLUB_BACKEND_URL}/api/auth/logout`), {
                withCredentials: true,
            });
            if (user?.role === 'TEACHER') window.location.href = `${process.env.NEXT_PUBLIC_IOI_CLUB_FRONTEND_URL}/auth/teacher/login`;
            else if (user?.role === 'STUDENT') window.location.href = `${process.env.NEXT_PUBLIC_IOI_CLUB_FRONTEND_URL}/auth/student/login`;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('Logout failed:', error.response?.data || error.message);
            }
        } finally {
            setIsLoggingOut(false);
            setIsLogoutDialogOpen(false);
        }
    };

    /**
     * Toggle mobile menu
     */
    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    /**
     * Close mobile menu when clicking on a nav item
     */
    const closeMobileMenu = () => {
        setIsMobileMenuOpen(false);
    };

    /**
     * Mobile menu toggle button component
     * Renders hamburger/close icon based on menu state
     */
    const MobileMenuButton = () => (
        <button
            onClick={toggleMobileMenu}
            className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-md border border-gray-200"
            aria-label="Toggle menu"
        >
            {isMobileMenuOpen ? (
                <X size={20} className="text-gray-600" />
            ) : (
                <Menu size={20} className="text-gray-600" />
            )}
        </button>
    );

    return (
        <>
            {/* Mobile menu button */}
            <MobileMenuButton />

            {/* Mobile overlay */}
            {isMobile && isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                    onClick={closeMobileMenu}
                />
            )}

            {/* Sidebar */}
            <div className={`
                fixed md:relative 
                ${isMobile ? 'top-0 left-0 h-full' : 'h-screen'}
                ${isMobile && !isMobileMenuOpen ? '-translate-x-full' : 'translate-x-0'}
                w-64 bg-white border-r border-gray-200 
                flex flex-col transition-transform duration-300 z-50
            `}>
                {/* Header Section */}
                <div className="px-8 py-[1.06rem] border-b border-gray-200">
                    <div className="flex items-center gap-3 cursor-pointer"
                        onClick={() => router.push('/')}>
                        {/* Institute of Innovation Logo */}
                        <Image
                            src="/ioilogo.png"
                            alt="Institute of Innovation Logo"
                            width={150}
                            height={40}
                        />
                    </div>
                </div>

                {/* Navigation Content */}
                <div className="flex-1 overflow-y-auto py-6">
                    <nav className="space-y-2 px-4">
                        {navigationItems.map((item) => {
                            const isActive = isItemActive(item);
                            return (
                                <Link
                                    key={item.id}
                                    href={item.navigation}
                                    onClick={closeMobileMenu}
                                    className={`
                                        w-full flex items-center space-x-3 px-4 py-3 rounded-lg 
                                        transition-colors group text-left
                                        ${isActive
                                            ? 'text-white'
                                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                                        }
                                    `}
                                    style={isActive ? { backgroundColor: '#1B3A6A' } : {}}
                                    title={item.label}
                                    aria-label={`Navigate to ${item.label}`}
                                >
                                    {/* Icon */}
                                    <div className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'
                                        }`}>
                                        {item.icon}
                                    </div>

                                    {/* Label */}
                                    <span className="font-medium truncate">{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Logout Section */}
                <div className="p-4 border-t border-gray-200">
                    <button
                        onClick={openLogoutDialog}
                        className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors group"
                        aria-label="Logout"
                    >
                        <div className="flex-shrink-0 text-gray-500 group-hover:text-gray-700">
                            <LogOut size={20} />
                        </div>
                        <span className="font-medium">Logout</span>
                    </button>
                </div>
            </div>

            {/* Logout Confirmation Dialog */}
            <LogoutDialog
                isOpen={isLogoutDialogOpen}
                onClose={closeLogoutDialog}
                onConfirm={handleLogout}
                isLoading={isLoggingOut}
            />
        </>
    );
};

export default QCAuditSidebar;