
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Dropdown from './Dropdown';
import { COURSE_CODES } from '../constants/courseCodes';

const HomePage: React.FC = () => {
    const navigate = useNavigate();

    const handleCourseSelect = (courseCode: string) => {
        if (courseCode) {
            navigate(`/course/${courseCode}`);
        }
    };

    return (
        <main className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 md:p-8 bg-gradient-to-br from-gray-900 to-gray-800">
            <div className="w-full max-w-2xl text-center">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-blue-500 mb-4 animate-fade-in-down">
                    Course File Organizer
                </h1>
                <p className="text-lg sm:text-xl text-gray-300 mb-8 animate-fade-in-up">
                    Select a course to view and manage its documents.
                </p>
                <div className="animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                    <Dropdown options={COURSE_CODES} onSelect={handleCourseSelect} />
                </div>
            </div>
            <style>{`
                @keyframes fade-in-down {
                    0% {
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes fade-in-up {
                    0% {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-fade-in-down {
                    animation: fade-in-down 0.5s ease-out forwards;
                }
                .animate-fade-in-up {
                    animation: fade-in-up 0.5s ease-out forwards;
                }
            `}</style>
        </main>
    );
};

export default HomePage;
