Feature: Authentication Persistence
  As a player
  I want my authentication to persist appropriately
  So that I have a seamless gaming experience while maintaining security

  Background:
    Given I am a registered user with email "player@example.com" and password "password123"

  Scenario: Session persists across page refreshes
    Given I am logged in
    When I refresh the page
    Then I should still be logged in
    And I should have access to protected features

  Scenario: Session persists when navigating between pages
    Given I am logged in
    When I navigate to the characters page
    And I navigate to the campaigns page
    And I navigate to the dashboard
    Then I should still be logged in
    And I should have access to protected features

  Scenario: Session persists after browser restart
    Given I am logged in
    And my authentication token is stored in local storage
    When I close and reopen the browser
    Then I should still be logged in
    And I should have access to protected features

  Scenario: Session expires after token timeout
    Given I am logged in
    And my authentication token has expired
    When I try to access a protected resource
    Then I should be redirected to the login page
    And I should see a message indicating my session has expired

  Scenario: Logout clears authentication
    Given I am logged in
    When I click the logout button
    Then I should be logged out
    And I should be redirected to the login page
    And I should not have access to protected features 