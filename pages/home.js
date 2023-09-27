"use client";
import React from 'react'
import Button from '@mui/material/Button';

const home = () => {
    const handleSubmit = (event) => {
        event.preventDefault();
      
        window.location.href = '/'; // You can use Next.js's client-side routing like this
    
      };
  return (
    <>
    
    <h1>HomePage</h1>
    <Button
              type="submit"
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              onClick={handleSubmit}
            >
              Log Out
            </Button>
    </>
  )
}

export default home