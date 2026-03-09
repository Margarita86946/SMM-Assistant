import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function CreatePost() {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate('/generate', { replace: true });
  }, [navigate]);

  return null;
}

export default CreatePost;