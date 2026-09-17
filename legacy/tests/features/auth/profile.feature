Feature: User Profile Management
  As a registered player
  I want to manage my StoryQuest profile
  So that I can keep my account information up to date

  Background:
    Given I am a registered user with username "adventurer", email "adventurer@example.com", and password "password123"

  Scenario: View profile information
    Given I am logged in
    When I navigate to the profile page
    Then I should see my username "adventurer"
    And I should see my email "adventurer@example.com"

  Scenario: Update profile information
    Given I am logged in
    And I am on the profile page
    When I update my username to "master_adventurer"
    And I click the save button
    Then I should see a success message
    And my username should be updated to "master_adventurer"

  Scenario: Update email address
    Given I am logged in
    And I am on the profile page
    When I update my email to "new_email@example.com"
    And I click the save button
    Then I should see a success message
    And my email should be updated to "new_email@example.com"

  Scenario: Update password
    Given I am logged in
    And I am on the profile page
    When I enter my current password "password123"
    And I enter a new password "newpassword456"
    And I confirm the new password "newpassword456"
    And I click the save password button
    Then I should see a success message
    And I should be able to log in with the new password "newpassword456"

  Scenario: Access profile without authentication
    Given I am not logged in
    When I try to access the profile page
    Then I should be redirected to the login page
    And I should see a message indicating I need to log in 