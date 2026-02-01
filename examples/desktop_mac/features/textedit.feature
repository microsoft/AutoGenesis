# language: en
Feature: Mac TextEdit Automation
  As a Mac user
  I want to automate TextEdit operations
  So that I can test document editing functionality

  Background:
    Given TextEdit is launched

  Scenario: Create a new document
    When I press Command+N to create a new document
    Then a new untitled document should appear
    And the document should be empty

  Scenario: Type and format text
    Given a new document is open
    When I type "Hello, AutoGenesis!"
    And I select all text with Command+A
    And I open the Format menu
    And I click "Font" > "Bold"
    Then the text should be bold

  Scenario: Save document
    Given a document with content "Test content"
    When I press Command+S to save
    And I enter "test_document" as the filename
    And I select "Desktop" as the location
    And I click "Save"
    Then the document should be saved
    And the window title should show "test_document"

  Scenario: Open existing document
    When I press Command+O to open
    And I navigate to "~/Documents"
    And I select "sample.txt"
    And I click "Open"
    Then the document content should be loaded
    And the window title should show "sample"

  Scenario: Find and replace
    Given a document with content "Hello World, Hello Universe"
    When I press Command+F to find
    And I enter "Hello" in the search field
    Then I should see 2 matches highlighted
    When I click "Replace" button
    And I enter "Hi" in the replace field
    And I click "Replace All"
    Then the document should contain "Hi World, Hi Universe"

  Scenario: Print preview
    Given a document with content "Print Test"
    When I press Command+P to print
    Then the print dialog should appear
    When I click "PDF" dropdown
    And I select "Open PDF in Preview"
    Then Preview should open with the document
