// src/config/passport.js
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/user.model");
require("dotenv").config();

function configurePassport(passport) {
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findByPk(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${
          process.env.API_URL || "http://localhost:5000"
        }/api/auth/google/callback`,
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists
          const existingUser = await User.findOne({
            where: { email: profile.emails[0].value },
          });

          if (existingUser) {
            return done(null, existingUser);
          }

          // Create new user if doesn't exist
          const newUser = await User.create({
            email: profile.emails[0].value,
            password_hash: Math.random().toString(36).substring(2), // Random password
            first_name:
              profile.name.givenName || profile.displayName.split(" ")[0],
            last_name:
              profile.name.familyName ||
              profile.displayName.split(" ").slice(1).join(" "),
            email_verified: true,
          });

          return done(null, newUser);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
}

module.exports = { configurePassport };
