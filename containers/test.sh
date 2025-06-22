docker run -v "${PWD}/..:/work" -w /work -it europe-docker.pkg.dev/wdw-21/songbook/github-latex-worker:latest /bin/bash
#docker run -v "${PWD}/..:/work" -w /work -it europe-docker.pkg.dev/wdw-21/songbook/github-latex-worker:latest ./render_pdf.sh songbook a4 test ./songs/alpuhara.xml
