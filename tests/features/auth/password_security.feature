Feature: Password Security
  As a player
  I want secure password management
  So that my account remains protected

  Background:
    Given I am a registered user with email "player@example.com" and password "password123"

  Scenario: Reset password with valid email
    Given I am on the forgot password page
    When I enter my email "player@example.com"
    And I click the reset password button
    Then I should see a confirmation message
    And I should receive a password reset email

  Scenario: Reset password with invalid email
    Given I am on the forgot password page
    When I enter an email "nonexistent@example.com"
    And I click the reset password button
    Then I should see a confirmation message
    But I should not receive a password reset email

  Scenario: Change password with valid current password
    Given I am logged in
    And I am on the profile page
    When I enter my current password "password123"
    And I enter a new password "newpassword456"
    And I confirm the new password "newpassword456"
    And I click the change password button
    Then I should see a success message
    And I should be able to log in with the new password "newpassword456"
    And I should not be able to log in with the old password "password123"

  Scenario: Change password with invalid current password
    Given I am logged in
    And I am on the profile page
    When I enter an incorrect current password "wrongpassword"
    And I enter a new password "newpassword456"
    And I confirm the new password "newpassword456"
    And I click the change password button
    Then I should see an error message
    And my password should not be changed

  Scenario: Change password with mismatched confirmation
    Given I am logged in
    And I am on the profile page
    When I enter my current password "password123"
    And I enter a new password "newpassword456"
    And I confirm the new password "differentpassword789"
    And I click the change password button
    Then I should see an error message about password mismatch
    And my password should not be changed 