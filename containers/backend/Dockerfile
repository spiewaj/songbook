FROM ubuntu:rolling
WORKDIR /app
ENV TZ=Europe/Warsaw
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
RUN apt-get update && apt-get -yq install python3 texlive texlive-latex-extra texlive-lang-polish pip pkg-config libicu-dev epubcheck python3-markupsafe python3-icu python3-lxml python3-jinja2 python3-yaml python3-cairosvg python3-pillow git xindy python3-venv && apt-get clean

COPY requirements.txt /tmp/songbook_reqs.txt
COPY containers/backend/requirements.txt /tmp/backend_reqs.txt

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN pip install -r /tmp/songbook_reqs.txt
RUN pip install -r /tmp/backend_reqs.txt

# Copy songbook scripts and backend
COPY . /app/

EXPOSE 8000

CMD ["uvicorn", "containers.backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
