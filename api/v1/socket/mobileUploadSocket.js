// api/v1/socket/mobileUploadSocket.js - Upload socket handler

const setupUploadSocket = (io) => {
  console.log("Setting up upload socket handlers...");

  // Create a separate namespace for uploads that doesn't require authentication
  const uploadNamespace = io.of("/uploads");

  // No authentication middleware for uploads - they use tokens instead
  uploadNamespace.on("connection", (socket) => {
    console.log(`Upload socket connected: ${socket.id}`);

    // Send connection confirmation
    socket.emit("connection-confirmed", {
      socketId: socket.id,
      timestamp: new Date().toISOString(),
      namespace: "/uploads",
    });

    // Handle upload token registration (for QR code uploads)
    socket.on("register-upload-token", (data) => {
      const { token, userId } = data;
      console.log(`Registering upload token: ${token} for user: ${userId}`);

      // Join a room specific to this upload token
      socket.join(`upload-${token}`);

      // Confirm registration
      socket.emit("token-registered", {
        success: true,
        token,
        message: "Upload token registered successfully",
        socketId: socket.id,
        room: `upload-${token}`,
      });

      console.log(`Socket ${socket.id} joined room: upload-${token}`);
    });

    // Handle upload token cleanup
    socket.on("cleanup-upload-token", (data) => {
      const { token } = data;
      console.log(`Cleaning up upload token: ${token}`);
      socket.leave(`upload-${token}`);
    });

    // Handle client connection confirmation
    socket.on("client-connected", (data) => {
      console.log("Upload client connected:", data);
      socket.emit("connection-confirmed", {
        socketId: socket.id,
        timestamp: new Date().toISOString(),
        message: "Upload socket ready",
        namespace: "/uploads",
      });
    });

    // Add ping/pong for connection health
    socket.on("ping", () => {
      socket.emit("pong", {
        timestamp: new Date().toISOString(),
        socketId: socket.id,
      });
    });

    socket.on("disconnect", (reason) => {
      console.log(`Upload socket ${socket.id} disconnected: ${reason}`);
    });
  });

  // Add debugging method to check active connections
  uploadNamespace.checkConnections = () => {
    const sockets = Array.from(uploadNamespace.sockets.keys());
    console.log(
      `Upload namespace has ${sockets.length} active connections:`,
      sockets
    );
    return sockets;
  };

  return uploadNamespace;
};

module.exports = { setupUploadSocket };
