FROM ubuntu
WORKDIR /app
ENV TZ=Europe/Warsaw
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
RUN apt-get update && apt-get -yq install texlive texlive-latex-extra texlive-lang-polish pip pkg-config libicu-dev epubcheck python3-markupsafe python3-icu python3-lxml python3-jinja2 python3-yaml python3-cairosvg python3-pillow git curl xindy && apt-get clean
#RUN tlmgr install truncate
#COPY ../requirements.txt /tmp/requirements.txt
#RUN pip3 install -r /tmp/requirements.txt
CMD ["/bin/bash"]
