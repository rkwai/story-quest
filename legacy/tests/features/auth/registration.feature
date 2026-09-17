Feature: User Registration
  As a new player
  I want to register for a StoryQuest account
  So that I can create characters and join campaigns

  Background:
    Given I am on the registration page

  Scenario: Successful registration
    When I enter a valid username "adventurer"
    And I enter a valid email "adventurer@example.com"
    And I enter a valid password "password123"
    And I click the register button
    Then I should be redirected to the dashboard
    And I should see a welcome message
    And I should be logged in

  Scenario: Registration with existing email
    Given a user exists with email "existing@example.com"
    When I enter a valid username "newuser"
    And I enter a valid email "existing@example.com"
    And I enter a valid password "password123"
    And I click the register button
    Then I should see an error message "User already exists"
    And I should remain on the registration page

  Scenario: Registration with invalid data
    When I enter a username "a"
    And I enter an invalid email "invalid-email"
    And I enter a short password "123"
    And I click the register button
    Then I should see validation errors
    And I should remain on the registration page 