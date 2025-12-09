import React from 'react';

const Button = ({ children, className = '', ...props }) => {
    return (
        <button
            className={`bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center whitespace-nowrap ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};

export default Button;
