import React from 'react';
import { Navigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  return <Navigate to="/workspace" replace />;
};

export default Dashboard;
