# Stage 1: Build the application
FROM denoland/deno:alpine AS build

WORKDIR /app

# Copy manifest and sources, then cache dependencies
COPY deno.json .
COPY config.ts .
COPY main.ts .
COPY src/ ./src/
RUN deno cache main.ts --config deno.json

# Compile
RUN deno compile --allow-net --allow-env --config deno.json --output server main.ts

# Stage 2: Create the final, small image
FROM denoland/deno:distroless-1.42.0

WORKDIR /app

# Copy the compiled executable from the build stage
COPY --from=build /app/server .

# Expose the port the app runs on
EXPOSE 8000

# Override the default entrypoint of the base image
ENTRYPOINT ["./server"]

# CMD is no longer needed here as ENTRYPOINT handles the execution
# CMD ["./server"]