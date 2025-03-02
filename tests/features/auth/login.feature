Feature: User Login
  As a registered player
  I want to log in to my StoryQuest account
  So that I can access my characters and campaigns

  Background:
    Given I am on the login page

  Scenario: Successful login
    Given a user exists with email "player@example.com" and password "password123"
    When I enter email "player@example.com"
    And I enter password "password123"
    And I click the login button
    Then I should be redirected to the dashboard
    And I should see my username displayed
    And I should have access to protected features

  Scenario: Login with incorrect password
    Given a user exists with email "player@example.com" and password "password123"
    When I enter email "player@example.com"
    And I enter password "wrongpassword"
    And I click the login button
    Then I should see an error message "Invalid credentials"
    And I should remain on the login page

  Scenario: Login with non-existent account
    When I enter email "nonexistent@example.com"
    And I enter password "password123"
    And I click the login button
    Then I should see an error message "Invalid credentials"
    And I should remain on the login page

  Scenario: Login with empty fields
    When I click the login button without entering credentials
    Then I should see validation errors
    And I should remain on the login page 