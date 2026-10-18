// Shared PDF rendering logic for Cloud Run
async function renderPdfCloudRun(payload, endpoint, onLoading, onSuccess, onError) {
    onLoading();

    try {
        const response = await fetch(`https://songbook-pdf-render-177765940460.europe-west1.run.app${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            onError("Błąd połączenia z serwerem PDF.");
            return;
        }

        const data = await response.json();
        const jobId = data.job_id;
        
        // Poll for completion
        const pollInterval = setInterval(async () => {
            try {
                const statusRes = await fetch(`https://songbook-pdf-render-177765940460.europe-west1.run.app/api/jobs/${jobId}`);
                if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    if (statusData.status === "done") {
                        clearInterval(pollInterval);
                        const finalUrl = statusData.url.startsWith("http")
                            ? statusData.url
                            : `https://songbook-pdf-render-177765940460.europe-west1.run.app${statusData.url}`;
                        onSuccess(finalUrl, statusData.format || "pdf", statusData.published_url);
                    } else if (statusData.status === "error") {
                        clearInterval(pollInterval);
                        const errorUrl = statusData.url
                            ? (statusData.url.startsWith("http") ? statusData.url : `https://songbook-pdf-render-177765940460.europe-west1.run.app${statusData.url}`)
                            : null;
                        onError("Błąd generowania pliku. Zobacz logi.", errorUrl);
                    }
                }
            } catch (e) {
                console.error("Polling error", e);
            }
        }, 2000);

    } catch (error) {
        console.error("Render error", error);
        onError("Błąd wysyłania do serwera renderującego.");
    }
}

// Promise wrapper for background artifact generation
function renderArtifactCloudRun(payload, endpoint = "/api/render/songbook_yaml") {
    return new Promise((resolve, reject) => {
        renderPdfCloudRun(
            payload,
            endpoint,
            () => {},
            (url, format, publishedUrl) => {
                const finalUrl = publishedUrl
                    ? (publishedUrl.startsWith("http") ? publishedUrl : `https://songbook-pdf-render-177765940460.europe-west1.run.app${publishedUrl}`)
                    : url;
                resolve({ url: finalUrl, rawJobUrl: url, publishedUrl, format });
            },
            (err, errUrl) => reject(new Error(err))
        );
    });
}

