FROM mono:latest
WORKDIR /app
COPY . .
RUN nuget restore VitragCRM.Backend.sln
RUN msbuild VitragCRM.Backend.sln /p:Configuration=Release /p:OutDir=/app/bin
EXPOSE 5001
CMD ["mono", "/app/bin/VitragCRM.Backend.exe"]
