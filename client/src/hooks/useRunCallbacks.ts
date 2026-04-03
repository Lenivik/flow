import { useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { api } from '../lib/api'

type SetNodes = (updater: (nodes: Node[]) => Node[]) => void

function appendImageResult(
  nodeId: string,
  imageUrl: string,
  result: { node_image_id?: number },
  setNodes: SetNodes,
) {
  const newEntry = { id: result.node_image_id as number, url: imageUrl }
  setNodes((nds) =>
    nds.map((n) => {
      if (n.id !== nodeId) return n
      const nd = n.data as Record<string, unknown>
      const history = [...((nd.imageHistory as { id: number; url: string }[]) || [])]
      history.push(newEntry)
      return { ...n, data: { ...nd, imageUrl, activeImageId: result.node_image_id, imageHistory: history, imageIndex: history.length - 1 } }
    }),
  )
}

interface UseRunCallbacksOptions {
  nodesRef: MutableRefObject<Node[]>
  edgesRef: MutableRefObject<Edge[]>
  setNodes: SetNodes
}

export function useRunCallbacks({ nodesRef, edgesRef, setNodes }: UseRunCallbacksOptions) {
  const handleRunModel = useCallback(async (nodeId: string): Promise<string | null> => {
    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current

    const promptEdge = currentEdges.find((e) => e.target === nodeId && e.targetHandle === 'prompt')
    const promptNode = promptEdge ? currentNodes.find((n) => n.id === promptEdge.source) : null
    const prompt = (promptNode?.data as Record<string, unknown>)?.prompt as string | undefined

    const negEdge = currentEdges.find((e) => e.target === nodeId && e.targetHandle === 'negative_prompt')
    const negNode = negEdge ? currentNodes.find((n) => n.id === negEdge.source) : null
    const negativePrompt = (negNode?.data as Record<string, unknown>)?.prompt as string | undefined

    if (!prompt?.trim()) {
      return 'No prompt connected. Connect a Text Prompt node to the Prompt input.'
    }

    try {
      const serverNodeId = nodeId.match(/^\d+$/) ? nodeId : undefined
      const nodeData = currentNodes.find((n) => n.id === nodeId)?.data as Record<string, unknown> | undefined
      const settings: Record<string, string> = {}
      if (nodeData?.resolution) settings.resolution = nodeData.resolution as string
      if (nodeData?.aspectRatio) settings.aspect_ratio = nodeData.aspectRatio as string
      if (nodeData?.outputFormat) settings.output_format = nodeData.outputFormat as string
      if (nodeData?.seed) settings.seed = nodeData.seed as string
      if (nodeData?.safetyTolerance) settings.safety_tolerance = nodeData.safetyTolerance as string
      const result = await api.generateImage(prompt, negativePrompt, serverNodeId, settings)
      if (result.error) return result.error

      const imageUrl = result.node_image_id
        ? await api.fetchNodeImageBlob(result.node_image_id)
        : `data:${result.mime_type};base64,${result.image_data}`

      appendImageResult(nodeId, imageUrl, result, setNodes)
      return null
    } catch (err) {
      return err instanceof Error ? err.message : 'Generation failed'
    }
  }, [nodesRef, edgesRef, setNodes])

  const handleRunBgRemoval = useCallback(async (nodeId: string): Promise<string | null> => {
    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current

    const inputEdge = currentEdges.find((e) => e.target === nodeId && e.targetHandle === 'input')
    const sourceNode = inputEdge ? currentNodes.find((n) => n.id === inputEdge.source) : null
    const sourceData = sourceNode?.data as Record<string, unknown> | undefined
    const isCaptureSource = inputEdge?.sourceHandle === 'image_result'
    // For non-capture sources (result handle): prefer activeImageId, fall back to captureUrl
    // so crop nodes (which have captureUrl but no activeImageId) work as input.
    const captureDataUrl = isCaptureSource
      ? (sourceData?.captureUrl as string | undefined)
      : (!sourceData?.activeImageId ? (sourceData?.captureUrl as string | undefined) : undefined)
    const sourceImageId = !isCaptureSource && sourceData?.activeImageId
      ? (sourceData.activeImageId as number)
      : undefined

    if (!captureDataUrl && !sourceImageId) {
      return isCaptureSource
        ? 'No viewport capture available. The 3D viewer must be visible to capture an image.'
        : 'No image connected. Connect an image output to the Input handle.'
    }

    try {
      const serverNodeId = nodeId.match(/^\d+$/) ? nodeId : undefined
      const result = await api.removeBg(sourceImageId, serverNodeId, captureDataUrl)
      if (result.error) return result.error

      const imageUrl = result.node_image_id
        ? await api.fetchNodeImageBlob(result.node_image_id)
        : `data:${result.mime_type};base64,${result.image_data}`

      appendImageResult(nodeId, imageUrl, result, setNodes)
      return null
    } catch (err) {
      return err instanceof Error ? err.message : 'Background removal failed'
    }
  }, [nodesRef, edgesRef, setNodes])

  const handleRunTrellis = useCallback(async (nodeId: string): Promise<string | null> => {
    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current

    const inputEdge = currentEdges.find((e) => e.target === nodeId && e.targetHandle === 'input')
    const sourceNode = inputEdge ? currentNodes.find((n) => n.id === inputEdge.source) : null
    const sourceImageId = (sourceNode?.data as Record<string, unknown>)?.activeImageId as number | undefined

    if (!sourceImageId) {
      return 'No image connected. Connect an image output to the Input handle.'
    }

    try {
      const serverNodeId = nodeId.match(/^\d+$/) ? nodeId : undefined
      const nodeData = currentNodes.find((n) => n.id === nodeId)?.data as Record<string, unknown> | undefined
      const settings: Record<string, string> = {}
      if (nodeData?.ssGuidanceStrength !== undefined) settings.ss_guidance_strength = String(nodeData.ssGuidanceStrength)
      if (nodeData?.ssSamplingSteps !== undefined) settings.ss_sampling_steps = String(nodeData.ssSamplingSteps)
      if (nodeData?.slatGuidanceStrength !== undefined) settings.slat_guidance_strength = String(nodeData.slatGuidanceStrength)
      if (nodeData?.slatSamplingSteps !== undefined) settings.slat_sampling_steps = String(nodeData.slatSamplingSteps)
      if (nodeData?.meshSimplify !== undefined) settings.mesh_simplify = String(nodeData.meshSimplify)
      if (nodeData?.textureSize !== undefined) settings.texture_size = String(nodeData.textureSize)
      if (nodeData?.seed !== undefined) settings.seed = String(nodeData.seed)
      const result = await api.generateTrellis(sourceImageId, serverNodeId, settings)
      if (result.error) return result.error

      const modelUrl = result.node_image_id
        ? await api.fetchNodeImageBlob(result.node_image_id)
        : undefined

      const newEntry = { id: result.node_image_id, url: modelUrl || '' }
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          const nd = n.data as Record<string, unknown>
          const history = [...((nd.imageHistory as { id: number; url: string }[]) || [])]
          history.push(newEntry)
          return { ...n, data: { ...nd, modelFile: modelUrl, activeImageId: result.node_image_id, imageHistory: history, imageIndex: history.length - 1 } }
        }),
      )
      return null
    } catch (err) {
      return err instanceof Error ? err.message : '3D generation failed'
    }
  }, [nodesRef, edgesRef, setNodes])

  const handleRunFlux2Flash = useCallback(async (nodeId: string): Promise<string | null> => {
    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current

    const promptEdge = currentEdges.find((e) => e.target === nodeId && e.targetHandle === 'prompt')
    const promptNode = promptEdge ? currentNodes.find((n) => n.id === promptEdge.source) : null
    const prompt = (promptNode?.data as Record<string, unknown>)?.prompt as string | undefined

    if (!prompt?.trim()) {
      return 'No prompt connected. Connect a Text Prompt node to the Prompt input.'
    }

    try {
      const serverNodeId = nodeId.match(/^\d+$/) ? nodeId : undefined
      const nodeData = currentNodes.find((n) => n.id === nodeId)?.data as Record<string, unknown> | undefined
      const settings: Record<string, string> = {}
      if (nodeData?.imageSize) settings.image_size = nodeData.imageSize as string
      if (nodeData?.guidanceScale) settings.guidance_scale = nodeData.guidanceScale as string
      if (nodeData?.outputFormat) settings.output_format = nodeData.outputFormat as string
      if (nodeData?.seed) settings.seed = nodeData.seed as string
      if (nodeData?.enablePromptExpansion) settings.enable_prompt_expansion = nodeData.enablePromptExpansion as string
      if (nodeData?.enableSafetyChecker !== undefined) settings.enable_safety_checker = String(nodeData.enableSafetyChecker)
      const result = await api.generateFlux2Flash(prompt, serverNodeId, settings)
      if (result.error) return result.error

      const imageUrl = result.node_image_id
        ? await api.fetchNodeImageBlob(result.node_image_id)
        : `data:${result.mime_type};base64,${result.image_data}`

      appendImageResult(nodeId, imageUrl, result, setNodes)
      return null
    } catch (err) {
      return err instanceof Error ? err.message : 'Generation failed'
    }
  }, [nodesRef, edgesRef, setNodes])

  const handleRunFlux2Edit = useCallback(async (nodeId: string): Promise<string | null> => {
    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current

    const promptEdge = currentEdges.find((e) => e.target === nodeId && e.targetHandle === 'prompt')
    const promptNode = promptEdge ? currentNodes.find((n) => n.id === promptEdge.source) : null
    const prompt = (promptNode?.data as Record<string, unknown>)?.prompt as string | undefined

    const inputEdge = currentEdges.find((e) => e.target === nodeId && e.targetHandle === 'input')
    const sourceNode = inputEdge ? currentNodes.find((n) => n.id === inputEdge.source) : null
    const sourceData = sourceNode?.data as Record<string, unknown> | undefined
    const isCaptureSource = inputEdge?.sourceHandle === 'image_result'
    // For non-capture sources (result handle): prefer activeImageId, fall back to captureUrl
    // so crop nodes (which have captureUrl but no activeImageId) work as input.
    const captureDataUrl = isCaptureSource
      ? (sourceData?.captureUrl as string | undefined)
      : (!sourceData?.activeImageId ? (sourceData?.captureUrl as string | undefined) : undefined)
    const sourceImageId = !isCaptureSource && sourceData?.activeImageId
      ? (sourceData.activeImageId as number)
      : undefined

    if (!prompt?.trim()) {
      return 'No prompt connected. Connect a Text Prompt node to the Prompt input.'
    }
    if (!captureDataUrl && !sourceImageId) {
      return isCaptureSource
        ? 'No viewport capture available. The 3D viewer must be visible to capture an image.'
        : 'No image connected. Connect an image output to the Image input.'
    }

    try {
      const serverNodeId = nodeId.match(/^\d+$/) ? nodeId : undefined
      const nodeData = currentNodes.find((n) => n.id === nodeId)?.data as Record<string, unknown> | undefined
      const settings: Record<string, string> = {}
      if (nodeData?.guidanceScale !== undefined) settings.guidance_scale = String(nodeData.guidanceScale)
      if (nodeData?.numInferenceSteps !== undefined) settings.num_inference_steps = String(nodeData.numInferenceSteps)
      if (nodeData?.imageSize) settings.image_size = nodeData.imageSize as string
      if (nodeData?.outputFormat) settings.output_format = nodeData.outputFormat as string
      if (nodeData?.seed !== undefined) settings.seed = String(nodeData.seed)
      if (nodeData?.enableSafetyChecker !== undefined) settings.enable_safety_checker = String(nodeData.enableSafetyChecker)
      const result = await api.generateFlux2Edit(prompt, sourceImageId, serverNodeId, settings, captureDataUrl)
      if (result.error) return result.error

      const imageUrl = result.node_image_id
        ? await api.fetchNodeImageBlob(result.node_image_id)
        : `data:${result.mime_type};base64,${result.image_data}`

      appendImageResult(nodeId, imageUrl, result, setNodes)
      return null
    } catch (err) {
      return err instanceof Error ? err.message : 'Image editing failed'
    }
  }, [nodesRef, edgesRef, setNodes])

  const handleRunMeshyV6 = useCallback(async (nodeId: string): Promise<string | null> => {
    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current

    const inputEdge = currentEdges.find((e) => e.target === nodeId && e.targetHandle === 'input')
    const sourceNode = inputEdge ? currentNodes.find((n) => n.id === inputEdge.source) : null
    const sourceImageId = (sourceNode?.data as Record<string, unknown>)?.activeImageId as number | undefined

    if (!sourceImageId) {
      return 'No image connected. Connect an image output to the Input handle.'
    }

    try {
      const serverNodeId = nodeId.match(/^\d+$/) ? nodeId : undefined
      const nodeData = currentNodes.find((n) => n.id === nodeId)?.data as Record<string, unknown> | undefined
      const settings: Record<string, string> = {}
      if (nodeData?.artStyle) settings.art_style = nodeData.artStyle as string
      if (nodeData?.topology) settings.topology = nodeData.topology as string
      if (nodeData?.targetPolycount !== undefined) settings.target_polycount = String(nodeData.targetPolycount)
      if (nodeData?.symmetryMode) settings.symmetry_mode = nodeData.symmetryMode as string
      if (nodeData?.poseMode) settings.pose_mode = nodeData.poseMode as string
      if (nodeData?.shouldRemesh !== undefined) settings.should_remesh = String(nodeData.shouldRemesh)
      if (nodeData?.shouldTexture !== undefined) settings.should_texture = String(nodeData.shouldTexture)
      if (nodeData?.enablePbr !== undefined) settings.enable_pbr = String(nodeData.enablePbr)

      // Resolve optional texture handle (connected image → texture_image_url)
      const textureEdge = currentEdges.find((e) => e.target === nodeId && e.targetHandle === 'texture')
      const textureSource = textureEdge ? currentNodes.find((n) => n.id === textureEdge.source) : null
      const textureImageId = (textureSource?.data as Record<string, unknown>)?.activeImageId as number | undefined

      if (nodeData?.texturePrompt) settings.texture_prompt = nodeData.texturePrompt as string

      const result = await api.generateMeshyV6(sourceImageId, serverNodeId, settings, textureImageId)
      if (result.error) return result.error

      const modelUrl = result.node_image_id
        ? await api.fetchNodeImageBlob(result.node_image_id)
        : undefined

      const newEntry = { id: result.node_image_id, url: modelUrl || '' }
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          const nd = n.data as Record<string, unknown>
          const history = [...((nd.imageHistory as { id: number; url: string }[]) || [])]
          history.push(newEntry)
          return { ...n, data: { ...nd, modelFile: modelUrl, activeImageId: result.node_image_id, imageHistory: history, imageIndex: history.length - 1 } }
        }),
      )
      return null
    } catch (err) {
      return err instanceof Error ? err.message : '3D generation failed'
    }
  }, [nodesRef, edgesRef, setNodes])

  return { handleRunModel, handleRunBgRemoval, handleRunTrellis, handleRunFlux2Flash, handleRunFlux2Edit, handleRunMeshyV6 }
}
