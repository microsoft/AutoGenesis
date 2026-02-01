# language: en
Feature: Mobile App Login
  As a mobile app user
  I want to log into the application
  So that I can access my personalized content

  Background:
    Given the app is launched

  Scenario: Successful login with valid credentials
    When I tap the "Sign In" button
    And I enter "testuser@example.com" in the email field
    And I enter "SecurePass123" in the password field
    And I tap the "Login" button
    Then I should see the home screen
    And I should see welcome message "Hello, Test User"

  Scenario: Login with invalid password
    When I tap the "Sign In" button
    And I enter "testuser@example.com" in the email field
    And I enter "wrongpassword" in the password field
    And I tap the "Login" button
    Then I should see error message "Invalid credentials"
    And I should remain on the login screen

  Scenario: Login with empty fields
    When I tap the "Sign In" button
    And I tap the "Login" button without entering credentials
    Then I should see validation error "Email is required"
    And I should see validation error "Password is required"

  Scenario: Forgot password flow
    When I tap the "Sign In" button
    And I tap the "Forgot Password?" link
    Then I should see the password reset screen
    When I enter "testuser@example.com" in the email field
    And I tap the "Send Reset Link" button
    Then I should see confirmation message "Reset link sent to your email"
