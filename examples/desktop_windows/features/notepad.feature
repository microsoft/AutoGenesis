# language: en
Feature: Windows Notepad Automation
  As a Windows user
  I want to automate Notepad operations
  So that I can test text editing functionality

  Background:
    Given Notepad is launched

  Scenario: Create and save a new file
    When I type "Hello, AutoGenesis!" in the editor
    And I press Ctrl+S to save
    And I enter "test_document.txt" as the filename
    And I click the "Save" button
    Then the file should be saved successfully
    And the window title should contain "test_document.txt"

  Scenario: Open an existing file
    When I click the "File" menu
    And I click "Open" menu item
    And I enter "C:\test\sample.txt" in the filename field
    And I click the "Open" button
    Then the editor should contain the file content
    And the window title should contain "sample.txt"

  Scenario: Find and replace text
    Given the editor contains "Hello World"
    When I press Ctrl+H to open Find and Replace
    And I enter "World" in the "Find what" field
    And I enter "AutoGenesis" in the "Replace with" field
    And I click "Replace All"
    Then the editor should contain "Hello AutoGenesis"
    And I should see "1 replacement(s) made" message

  Scenario: Change font settings
    When I click the "Format" menu
    And I click "Font..." menu item
    Then the Font dialog should appear
    When I select "Consolas" from the font list
    And I select "12" from the size list
    And I click "OK"
    Then the font should be changed

  Scenario: Word wrap toggle
    When I click the "Format" menu
    And I click "Word Wrap" menu item
    Then word wrap should be enabled
    When I click the "Format" menu again
    And I click "Word Wrap" menu item
    Then word wrap should be disabled
