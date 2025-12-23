
from behave import *
import logging
from features.environment import call_tool_sync, get_tool_json, package

# --- auto-generated step ---
@given('I have launched Edge browser')
def step_impl(context):
    result = call_tool_sync(context, context.session.call_tool(
        name="app_launch", 
        arguments={'arguments': ['--no-first-run'], 'caller': 'behave-automation'}
    ))
    result_json = get_tool_json(result)
    assert result_json.get("status") == "success", f"Expected status to be 'success', got '{result_json.get('status')}', error: '{result_json.get('error')}'" 

# --- auto-generated step ---
@when('I click the search box in NTP page')
def step_impl(context):
    result = call_tool_sync(context, context.session.call_tool(
        name="click_element", 
        arguments={
            'caller': 'behave-automation',
            'locator_value': f"{package}:id/url_bar",
            'locator_strategy': 'AppiumBy.ID'
        }
    ))
    result_json = get_tool_json(result)
    assert result_json.get("status") == "success", f"Expected status to be 'success', got '{result_json.get('status')}', error: '{result_json.get('error')}'" 

# --- auto-generated step ---
@step('I input "msn.com" in the search box')
def step_impl(context):
    result = call_tool_sync(context, context.session.call_tool(
        name="send_keys", 
        arguments={
            'caller': 'behave-automation',
            'locator_value': f"{package}:id/url_bar",
            'locator_strategy': 'AppiumBy.ID',
            'text': 'msn.com'
        }
    ))
    result_json = get_tool_json(result)
    assert result_json.get("status") == "success", f"Expected status to be 'success', got '{result_json.get('status')}', error: '{result_json.get('error')}'" 

# --- auto-generated step ---
@step('I press enter to navigate to the page')
def step_impl(context):
    result = call_tool_sync(context, context.session.call_tool(
        name="press_key", 
        arguments={'caller': 'behave-automation', 'text': '66'}
    ))
    result_json = get_tool_json(result)
    assert result_json.get("status") == "success", f"Expected status to be 'success', got '{result_json.get('status')}', error: '{result_json.get('error')}'" 

# --- auto-generated step ---
@step('I wait for the page to load completely')
def step_impl(context):
    result = call_tool_sync(context, context.session.call_tool(
        name="time_sleep", 
        arguments={'caller': 'behave-automation', 'seconds': 5}
    ))
    result_json = get_tool_json(result)
    assert result_json.get("status") == "success", f"Expected status to be 'success', got '{result_json.get('status')}', error: '{result_json.get('error')}'" 

# --- auto-generated step ---
@then('I should see the tab with the title "msn.com"')
def step_impl(context):
    result = call_tool_sync(context, context.session.call_tool(
        name="verify_element_attribute", 
        arguments={
            'caller': 'behave-automation',
            'locator_value': f"{package}:id/url_bar",
            'locator_strategy': 'AppiumBy.ID',
            'attribute_name': 'text',
            'expected_value': 'msn.com',
            'rule': '=='
        }
    ))
    result_json = get_tool_json(result)
    assert result_json.get("status") == "success", f"Expected status to be 'success', got '{result_json.get('status')}', error: '{result_json.get('error')}'" 
