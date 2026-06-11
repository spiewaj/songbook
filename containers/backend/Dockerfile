FROM python:3.13-bookworm
WORKDIR /app
ENV TZ=Europe/Warsaw
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
RUN apt-get update && apt-get -yq install texlive texlive-latex-extra texlive-lang-polish \
    pkg-config libicu-dev epubcheck git xindy && \
    apt-get clean

COPY requirements.txt /tmp/songbook_reqs.txt
COPY containers/backend/requirements.txt /tmp/backend_reqs.txt

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN pip install -r /tmp/songbook_reqs.txt
RUN pip install -r /tmp/backend_reqs.txt

# Copy songbook scripts and backend
COPY . /app/

EXPOSE 8080

CMD sh -c "uvicorn containers.backend.main:app --host 0.0.0.0 --port ${PORT:-8080}"
