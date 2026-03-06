# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

from pydantic import BaseModel, Field
import json


def img_task_prompt(task_info: str = "") -> str:
    """
    Generates a prompt to analyze a screenshot and determine if it satisfies the given task information.

    Args:
        task_info (str): The specific task to evaluate based on the screenshot.

    Returns:
        str: A formatted prompt for the task.
    """
    return f"""
        ### **Task:**
        You are provided with an image that is a screenshot. 
        Your task is to analyze the screenshot and determine if it satisfies the following requirement: {task_info}.

        ### **Instructions:**
        1. Analyze the screenshot for visual indicators that are relevant to the task. Look for elements such as:
        - Presence or absence of specific visual components mentioned in the task.
        - Any text, images, or UI elements that are critical to fulfilling the task.
        - Any error messages, alerts, or missing elements that might indicate the task is not satisfied.
        2. Based on your analysis, decide whether the screenshot satisfies the task requirement.
        3. Make sure your explanation clearly states the observed visual cues that led to your conclusion.

        ### **Note:**
        Focus your analysis on aspects related to the task requirement, regardless of the source of the screenshot.

        """


class ImgTaskResponse(BaseModel):
    """
    Response model for image task evaluation.

    Attributes:
        result (bool): Indicates whether the task is satisfied.
        reason (str): Explanation of the evaluation result.
    """

    result: bool = Field(..., description="Indicates whether the task is satisfied")
    reason: str = Field(..., description="Explanation of the evaluation result")

    @classmethod
    def get_json_schema(cls) -> str:
        """return json schema for the response model"""
        return json.dumps(cls.model_json_schema(), indent=2)

    @classmethod
    def get_format_description(cls) -> str:
        """return concise format description for prompt"""
        schema = cls.model_json_schema()
        properties = schema.get("properties", {})

        format_desc = "{\n"
        for field_name, field_info in properties.items():
            field_type = field_info.get("type", "any")
            description = field_info.get("description", "")
            format_desc += f'  "{field_name}": {field_type}  // {description}\n'
        format_desc += "}"

        return format_desc

    @classmethod
    def get_example_json(cls) -> str:
        """return example JSON"""
        example = {"result": True, "reason": "The screenshot shows the expected elements and satisfies the task requirements."}
        return json.dumps(example, indent=2)

    @classmethod
    def get_prompt_format(cls) -> str:
        """return complete prompt format description"""
        return f"""
            Response must be in strict JSON format with the following structure:

            {cls.get_format_description()}

            Example:
            {cls.get_example_json()}

            Required fields:
            - result: boolean indicating if task is satisfied
            - reason: string explanation of the evaluation result
            """
