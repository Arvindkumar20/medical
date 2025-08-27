# Node image
FROM node:18

# Workdir
WORKDIR /app

# Copy package.json and install deps
COPY package*.json ./
RUN npm install

# Copy code
COPY . .

# Expose port
EXPOSE 5000

# Start server
CMD ["npm", "start"]
