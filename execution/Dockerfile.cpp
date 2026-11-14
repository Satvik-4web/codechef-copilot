# Isolated Sandbox Environment for C++17 Competitive Programming Execution
FROM alpine:3.19

# Install g++ and essential build tools
RUN apk add --no-cache g++ make libstdc++

# Create a non-privileged sandbox user
RUN adduser -D -u 1000 sandbox

WORKDIR /sandbox

# Drop root privileges by default
USER sandbox

CMD ["sh"]
