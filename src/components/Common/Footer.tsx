import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="site-footer">
      <p>Made for simpler file work.</p>
      <p>&copy; {new Date().getFullYear()} Compactor</p>
    </footer>
  );
};
