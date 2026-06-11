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
                        const finalUrl = `https://songbook-pdf-render-177765940460.europe-west1.run.app${statusData.url}`;
                        onSuccess(finalUrl);
                    } else if (statusData.status === "error") {
                        clearInterval(pollInterval);
                        const errorUrl = `https://songbook-pdf-render-177765940460.europe-west1.run.app${statusData.url}`;
                        onError("Błąd generowania PDF. Zobacz logi.", errorUrl);
                    }
                }
            } catch (e) {
                console.error("Polling error", e);
            }
        }, 2000);

    } catch (error) {
        console.error("PDF render error", error);
        onError("Błąd wysyłania do serwera PDF.");
    }
}
