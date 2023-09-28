"use client";
import React, { useState } from "react";
import Button from "@mui/material/Button";

const FileUpload = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [downloadLink, setDownloadLink] = useState(null);

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      // Handle the case where no file is selected
      return;
    }

    const formData = new FormData();
    formData.append("csvFile", selectedFile); // Make sure to use 'csvFile' as the field name

    try {
      const response = await fetch("http://localhost:3001/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        // Handle success (e.g., show a success message)
        console.log("CSV file uploaded successfully");
        const result = await response.json();
        console.log(result, "result is here");
        setDownloadLink(result.result);
        console.log("result.result", result.result);
      } else {
        // Handle error (e.g., show an error message)
        console.error("Failed to upload CSV file");
      }
    } catch (error) {
      // Handle network or other errors
      console.error("An error occurred while uploading the CSV file:", error);
    }
  };

  const handleDownload = () => {
    if (downloadLink) {
      const filename = "filtered_emails.xlsx"; // Replace with the desired filename
      const downloadUrl = `http://localhost:3001/download/${filename}`; // Replace with the correct endpoint

      fetch(downloadUrl, {
        method: "GET",
      })
        .then((response) => {
          // Check if the response status is OK (200) and content type is valid
          if (
            response.status === 200 &&
            response.headers.get("content-type") ===
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          ) {
            // Create a blob from the response data
            return response.blob();
          } else {
            // Handle the case where the file is not available or has an invalid content type
            throw new Error("File not available for download");
          }
        })
        .then((blob) => {
          // Create a URL for the blob
          const blobUrl = window.URL.createObjectURL(blob);

          // Create an anchor element to trigger the download
          const anchor = document.createElement("a");
          anchor.href = blobUrl;
          anchor.download = filename;
          anchor.click();

          // Clean up by revoking the blob URL
          window.URL.revokeObjectURL(blobUrl);
        })
        .catch((error) => {
          console.error("Download failed:", error.message);
          // Handle the error (e.g., show an error message to the user)
        });
    }
  };

  return (
    <div>
      <input type="file" accept=".csv" onChange={handleFileChange} />
      <Button
        type="submit"
        variant="contained"
        sx={{ mt: 3, mb: 2 }}
        onClick={handleUpload}
      >
        Upload
      </Button>
      {downloadLink && (
        <>
          <Button
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            onClick={handleDownload}
          >
            Download Processed File
          </Button>
          <a
            id="downloadLink"
            href={downloadLink}
            download="filtered_emails.xlsx"
            style={{ display: "none" }}
          >
            Download
          </a>
        </>
      )}
    </div>
  );
};

const Home = () => {
  const handleSubmit = (event) => {
    event.preventDefault();

    window.location.href = "/"; // You can use Next.js's client-side routing like this
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
      <FileUpload />
    </>
  );
};

export default Home;
